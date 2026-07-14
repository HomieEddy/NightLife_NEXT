import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getLiveEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function createClient(): PrismaClient {
  const env = getLiveEnv();
  const adapter = new PrismaPg(env.DATABASE_URL);
  return new PrismaClient({ adapter });
}

export function getRawPrisma(): PrismaClient {
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = createClient();
  }
  return globalForPrisma.__prisma;
}

export interface SessionContext {
  venueId: string;
}

/**
 * Returns a Prisma client extension that injects venueId into every query
 * on tenant-scoped models. Handlers physically cannot forget scoping.
 */
export function getDb(session: SessionContext) {
  const client = getRawPrisma();
  return client.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        if (!model) return query(args);
        const platformModels = [
          "Tenant", "JobRun",
          "User", "Session", "Account", "Verification",
          "Organization", "Member", "Invitation",
          "StaffProfile",
          // Venue's own id IS the venueId (1:1 with Organization) — handlers
          // filter by id: session.venueId directly instead of a venueId column.
          "Venue",
          // Join tables — scoped via their parent's venueId FK, not their own.
          "PackageComponent",
          "OrderItem",
          "FeeLine",
          "EventGuest",
        ];
        if (platformModels.includes(model)) return query(args);

        if (
          operation === "findMany" ||
          operation === "findFirst" ||
          operation === "findUnique" ||
          operation === "count" ||
          operation === "aggregate" ||
          operation === "groupBy"
        ) {
          args.where = { ...args.where, venueId: session.venueId };
        } else if (operation === "create") {
          args.data = { ...args.data, venueId: session.venueId };
        } else if (operation === "createMany") {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((d: Record<string, unknown>) => ({
              ...d,
              venueId: session.venueId,
            }));
          } else {
            args.data = { ...args.data, venueId: session.venueId };
          }
        } else if (
          operation === "update" ||
          operation === "updateMany" ||
          operation === "delete" ||
          operation === "deleteMany"
        ) {
          args.where = { ...args.where, venueId: session.venueId };
        }
        return query(args);
      },
    },
  });
}

/**
 * Unscoped client for platform-admin operations (tenants, billing, leads).
 * Import restricted to src/server/platform/ by ESLint rule.
 */
export function getPlatformDb(): PrismaClient {
  return getRawPrisma();
}
