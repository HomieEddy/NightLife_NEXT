import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getLiveEnv } from "@/features/shared/env";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function createClient(): PrismaClient {
  const env = getLiveEnv();
  const configuredMax = Number(process.env.DATABASE_POOL_MAX);
  const adapter = Number.isInteger(configuredMax) && configuredMax > 0
    ? new PrismaPg({ connectionString: env.DATABASE_URL, max: configuredMax })
    : new PrismaPg(env.DATABASE_URL);
  // ponytail: PrismaPg default is undefined (unlimited). Logging the actual
  // size so every boot confirms the pool config — silent misconfiguration
  // (forgot DATABASE_POOL_MAX) is the most common connection-exhaustion cause.
  const poolSize = Number.isInteger(configuredMax) && configuredMax > 0
    ? configuredMax
    : "unlimited (adapter default)";
  console.log(`[db] Prisma pool max: ${poolSize}`);
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
          "Lead", "LeadActivity",
          "PlanConfig", "TelemetryLink", "AdminAction",
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
          "ReportRun",
          "NotificationLog",
          "IncidentNote",
          // Purchasing: scoped via parent Supplier, not own venueId.
          "SupplierItem",
          // Pulse (WS-2): scoped via parent AttentionItem, not own venueId.
          "AttentionAcknowledgment",
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

/** The venueId-scoped Prisma client returned by getDb. */
export type ScopedDb = ReturnType<typeof getDb>;

/**
 * Unscoped client for genuinely cross-tenant / pre-session work: platform-admin
 * (tenants, billing, leads), entitlement limit checks that count across a
 * venue's own rows, public and cron endpoints with no session, and the guest
 * bootstrap before a venue is resolved. It performs NO venueId scoping — every
 * caller must scope by hand. Tenant-scoped handlers use getDb(session) instead;
 * UI components must never import either (enforced by ESLint).
 */
export function getPlatformDb(): PrismaClient {
  return getRawPrisma();
}
