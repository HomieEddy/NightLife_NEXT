import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { _resetEnvCache } from "@/lib/env";

export interface TestDb {
  url: string;
  rawClient: PrismaClient;
  teardown: () => Promise<void>;
}

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

/**
 * Spins up an in-process Postgres via PGlite, applies all Prisma migrations,
 * and returns a PrismaClient connected to it. No Docker needed.
 *
 * The returned rawClient is also installed as the db.ts singleton so that
 * getDb() reuses the same connection pool (PGlite serialises queries).
 */
export async function createTestDb(): Promise<TestDb> {
  if (globalForPrisma.__prisma) {
    await globalForPrisma.__prisma.$disconnect().catch(() => {});
    delete globalForPrisma.__prisma;
  }

  const db = new PGlite();

  const migrationsDir = join(process.cwd(), "prisma", "migrations");
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const dir of dirs) {
    const sqlPath = join(migrationsDir, dir.name, "migration.sql");
    try {
      const sql = readFileSync(sqlPath, "utf-8");
      await db.exec(sql);
    } catch {
      // skip dirs without migration.sql
    }
  }

  const server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();
  const url = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;

  process.env.DATABASE_URL = url;
  process.env.AUTH_SECRET = "test-secret-at-least-16";
  process.env.QR_TOKEN_SECRET = "test-qr-secret-at-least-16";
  _resetEnvCache();

  // PGlite serialises queries — limit pool to 1 connection to avoid socket churn
  const adapter = new PrismaPg({ connectionString: url, max: 1 });
  const rawClient = new PrismaClient({ adapter });

  // Install as the db.ts singleton so getDb() shares this connection
  globalForPrisma.__prisma = rawClient;

  return {
    url,
    rawClient,
    teardown: async () => {
      delete globalForPrisma.__prisma;
      _resetEnvCache();
      await rawClient.$disconnect();
      await server.stop();
      await db.close();
    },
  };
}
