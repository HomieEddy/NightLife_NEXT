/**
 * Starts an in-process Postgres via PGlite on a local TCP port, applies all
 * Prisma migrations, optionally seeds, then launches `next dev`.
 *
 * Usage: npx tsx scripts/pglite-dev.ts [--seed]
 *
 * Replaces the need for Docker + real Postgres during development.
 */

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const DATA_DIR = join(process.cwd(), ".pglite-data");
const shouldSeed = process.argv.includes("--seed");

async function main() {
  console.log("[pglite-dev] Starting in-process Postgres...");

  const db = new PGlite(DATA_DIR);

  const migrationsDir = join(process.cwd(), "prisma", "migrations");
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .sort((a, b) => a.name.localeCompare(b.name));

  await db.exec(`
    CREATE TABLE IF NOT EXISTS _pglite_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied = await db.query<{ name: string }>(
    "SELECT name FROM _pglite_migrations"
  );
  const appliedSet = new Set(applied.rows.map((r) => r.name));

  for (const dir of dirs) {
    if (appliedSet.has(dir.name)) continue;
    const sqlPath = join(migrationsDir, dir.name, "migration.sql");
    try {
      const sql = readFileSync(sqlPath, "utf-8");
      await db.exec(sql);
      await db.exec(
        `INSERT INTO _pglite_migrations (name) VALUES ('${dir.name}')`
      );
      console.log(`[pglite-dev] Applied migration: ${dir.name}`);
    } catch (err) {
      console.error(`[pglite-dev] Migration failed: ${dir.name}`, err);
      process.exit(1);
    }
  }

  // Port 0 = OS picks a free port
  const server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();
  const connStr = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;
  console.log(`[pglite-dev] Postgres ready at ${connStr}`);

  if (shouldSeed) {
    console.log("[pglite-dev] Seeding...");
    const seedProc = spawn("npx", ["tsx", "prisma/seed.ts"], {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, DATABASE_URL: connStr },
    });
    await new Promise<void>((resolve, reject) => {
      seedProc.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`Seed exited ${code}`))
      );
    });
  }

  console.log("[pglite-dev] Starting next dev...");
  const next = spawn("npx", ["next", "dev"], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      DATABASE_URL: connStr,
      NEXT_PUBLIC_APP_MODE: "live",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-secret-at-least-32-characters-long-ok",
      QR_TOKEN_SECRET: process.env.QR_TOKEN_SECRET ?? "dev-qr-token-secret-key-minimum-16",
    },
  });

  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, async () => {
      next.kill(sig);
      await server.stop();
      await db.close();
      process.exit(0);
    });
  }

  next.on("exit", async (code) => {
    await server.stop();
    await db.close();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
