/**
 * Platform-admin server logic — leads, tenants, plan configs, telemetry
 * links, provisioning, metrics aggregation, and admin-action audit log.
 * All functions take the raw (unscoped) PrismaClient from getPlatformDb().
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  Lead, LeadStatus, PlanConfig, TelemetryLink,
  Tenant, TenantMetrics, TenantPlan, TenantStaffMember,
  TenantProvisioning, TenantStatus, FeatureKey,
} from "@/lib/types";
import type { AuthSession } from "@/features/platform/auth-helpers";

// ── Mapping helpers ─────────────────────────────────────────────────

type LeadRow = Awaited<ReturnType<PrismaClient["lead"]["findUnique"]>> & {
  activity: Awaited<ReturnType<PrismaClient["leadActivity"]["findMany"]>>;
};

function toLead(row: NonNullable<LeadRow>): Lead {
  return {
    id: row.id,
    venueName: row.venueName,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    city: row.city,
    status: row.status as LeadStatus,
    source: row.source as Lead["source"],
    dealValue: row.dealValue,
    notes: row.notes,
    activity: row.activity.map((a) => ({
      id: a.id,
      at: a.createdAt.toISOString(),
      text: a.text,
    })),
    createdAt: row.createdAt.toISOString(),
  };
}

function toPlanConfig(row: {
  id: string; name: string; monthlyPrice: number; tagline: string;
  highlight: boolean; tableLimit: number | null; staffLimit: number | null;
  features: string[];
}): PlanConfig {
  return {
    id: row.id as TenantPlan,
    name: row.name,
    monthlyPrice: row.monthlyPrice / 100,
    tagline: row.tagline,
    highlight: row.highlight,
    tableLimit: row.tableLimit,
    staffLimit: row.staffLimit,
    features: row.features as FeatureKey[],
  };
}

function toTelemetryLink(row: {
  id: string; name: string; url: string; category: string;
}): TelemetryLink {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    category: row.category as TelemetryLink["category"],
  };
}

// ── Leads ───────────────────────────────────────────────────────────

const leadInclude = { activity: { orderBy: { createdAt: "asc" as const } } };

export async function listLeads(db: PrismaClient): Promise<Lead[]> {
  const rows = await db.lead.findMany({
    include: leadInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toLead);
}

export async function getLead(db: PrismaClient, leadId: string): Promise<Lead | null> {
  const row = await db.lead.findUnique({ where: { id: leadId }, include: leadInclude });
  return row ? toLead(row) : null;
}

export async function createLead(
  db: PrismaClient,
  input: { venueName: string; contactName: string; email: string; phone?: string; city?: string; source?: string; dealValue?: number; notes?: string },
): Promise<Lead> {
  const row = await db.lead.create({
    data: {
      venueName: input.venueName,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone ?? "",
      city: input.city ?? "",
      source: input.source ?? "landing-page",
      dealValue: input.dealValue ?? 0,
      notes: input.notes ?? "",
      activity: { create: { text: "Lead created" } },
    },
    include: leadInclude,
  });
  return toLead(row);
}

export async function updateLead(
  db: PrismaClient,
  leadId: string,
  patch: { venueName?: string; contactName?: string; email?: string; phone?: string; city?: string; dealValue?: number; notes?: string },
): Promise<Lead | null> {
  const row = await db.lead.update({
    where: { id: leadId },
    data: patch,
    include: leadInclude,
  }).catch(() => null);
  return row ? toLead(row) : null;
}

export async function deleteLead(db: PrismaClient, leadId: string): Promise<void> {
  await db.lead.delete({ where: { id: leadId } }).catch(() => {});
}

export async function setLeadStatus(
  db: PrismaClient,
  leadId: string,
  status: LeadStatus,
): Promise<Lead | null> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  const previous = lead.status;
  const row = await db.lead.update({
    where: { id: leadId },
    data: {
      status,
      activity: { create: { text: `Stage: ${previous} → ${status}` } },
    },
    include: leadInclude,
  });
  return toLead(row);
}

export async function addLeadNote(
  db: PrismaClient,
  leadId: string,
  text: string,
): Promise<Lead | null> {
  const row = await db.lead.update({
    where: { id: leadId },
    data: { activity: { create: { text } } },
    include: leadInclude,
  }).catch(() => null);
  return row ? toLead(row) : null;
}

// ── Tenants ─────────────────────────────────────────────────────────

async function tenantMetrics(db: PrismaClient, orgId: string): Promise<TenantMetrics> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [orderCount, sessionCount, tableCount, staffCount, zoneCount, lastOrder] =
    await Promise.all([
      db.order.count({ where: { venueId: orgId, placedAt: { gte: thirtyDaysAgo } } }),
      db.guestSession.count({ where: { venueId: orgId, createdAt: { gte: thirtyDaysAgo } } }),
      db.venueTable.count({ where: { venueId: orgId } }),
      db.member.count({ where: { organizationId: orgId } }),
      db.zone.count({ where: { venueId: orgId } }),
      db.order.findFirst({ where: { venueId: orgId }, orderBy: { placedAt: "desc" }, select: { placedAt: true } }),
    ]);

  return {
    orderCount30d: orderCount,
    sessionCount30d: sessionCount,
    tableCount,
    staffCount,
    zoneCount,
    lastActivityAt: lastOrder?.placedAt.toISOString() ?? new Date().toISOString(),
  };
}

async function tenantStaff(db: PrismaClient, orgId: string): Promise<TenantStaffMember[]> {
  const members = await db.member.findMany({
    where: { organizationId: orgId },
    include: { user: { include: { staffProfile: true } } },
  });
  return members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    role: (m.user.staffProfile?.role ?? m.role) as TenantStaffMember["role"],
    email: m.user.email,
  }));
}

async function tenantProvisioning(db: PrismaClient, orgId: string): Promise<TenantProvisioning> {
  const venue = await db.venue.findUnique({ where: { id: orgId } });
  if (!venue) {
    return { timezone: "UTC", currency: "USD", serviceFees: [], menuCategories: [] };
  }
  const categories = await db.menuCategory.findMany({
    where: { venueId: orgId },
    select: { name: true },
    orderBy: { sortOrder: "asc" },
  });
  const fees = venue.serviceFees as { name: string; type: "percentage" | "flat"; value: number }[];
  return {
    timezone: venue.timezone,
    currency: venue.currency,
    serviceFees: Array.isArray(fees) ? fees : [],
    menuCategories: categories.map((c) => c.name),
  };
}

function tenantMrr(plan: string, status: string, configs: PlanConfig[]): number {
  if (status !== "active") return 0;
  return configs.find((c) => c.id === plan)?.monthlyPrice ?? 0;
}

export async function listTenants(db: PrismaClient): Promise<Tenant[]> {
  const rows = await db.tenant.findMany({ orderBy: { createdAt: "desc" } });
  const configs = await listPlanConfigs(db);

  const tenants = await Promise.all(
    rows.map(async (row) => {
      const orgId = row.id;
      const org = await db.organization.findUnique({ where: { id: orgId } });
      const [metrics, staff, provisioning] = await Promise.all([
        tenantMetrics(db, orgId),
        tenantStaff(db, orgId),
        tenantProvisioning(db, orgId),
      ]);
      return {
        id: row.id,
        slug: row.slug,
        venueName: org?.name ?? row.name,
        plan: row.plan as TenantPlan,
        status: row.status as TenantStatus,
        city: (await db.venue.findUnique({ where: { id: orgId }, select: { city: true } }))?.city ?? "",
        mrr: tenantMrr(row.plan, row.status, configs),
        metrics,
        staff,
        provisioning,
        createdAt: row.createdAt.toISOString(),
      } satisfies Tenant;
    }),
  );

  return tenants;
}

export async function getTenant(db: PrismaClient, tenantId: string): Promise<Tenant | null> {
  const row = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!row) return null;

  const org = await db.organization.findUnique({ where: { id: tenantId } });
  const configs = await listPlanConfigs(db);
  const [metrics, staff, provisioning] = await Promise.all([
    tenantMetrics(db, tenantId),
    tenantStaff(db, tenantId),
    tenantProvisioning(db, tenantId),
  ]);
  const venue = await db.venue.findUnique({ where: { id: tenantId }, select: { city: true } });

  return {
    id: row.id,
    slug: row.slug,
    venueName: org?.name ?? row.name,
    plan: row.plan as TenantPlan,
    status: row.status as TenantStatus,
    city: venue?.city ?? "",
    mrr: tenantMrr(row.plan, row.status, configs),
    metrics,
    staff,
    provisioning,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function updateTenant(
  db: PrismaClient,
  tenantId: string,
  patch: { plan?: TenantPlan; status?: TenantStatus; name?: string },
  session: AuthSession,
): Promise<Tenant | null> {
  const before = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!before) return null;

  await db.tenant.update({ where: { id: tenantId }, data: patch });
  if (patch.name) {
    await db.organization.update({ where: { id: tenantId }, data: { name: patch.name } }).catch(() => {});
  }

  await logAdminAction(db, session, tenantId, "update_tenant", {
    plan: before.plan, status: before.status, name: before.name,
  }, { ...patch });

  return getTenant(db, tenantId);
}

export async function deleteTenant(
  db: PrismaClient,
  tenantId: string,
  session: AuthSession,
): Promise<void> {
  const before = await db.tenant.findUnique({ where: { id: tenantId } });

  await db.venue.delete({ where: { id: tenantId } }).catch(() => {});
  await db.organization.delete({ where: { id: tenantId } }).catch(() => {});
  await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});

  if (before) {
    await logAdminAction(db, session, tenantId, "delete_tenant", {
      name: before.name, plan: before.plan, status: before.status,
    }, null);
  }
}

export async function provisionTenant(
  db: PrismaClient,
  input: { venueName: string; city: string },
  session: AuthSession,
): Promise<Tenant> {
  const slug = input.venueName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const existing = await db.tenant.findUnique({ where: { slug } });
  if (existing) return (await getTenant(db, existing.id))!;

  const tenant = await db.tenant.create({
    data: { name: input.venueName, slug, plan: "starter", status: "trial" },
  });

  const org = await db.organization.create({
    data: { id: tenant.id, name: input.venueName, slug },
  });

  await db.venue.create({
    data: {
      id: org.id,
      address: "",
      city: input.city,
      timezone: "America/Toronto",
      currency: "CAD",
      openingHours: [],
      serviceFees: [{ name: "Service", type: "percentage", value: 5 }],
      floorMap: { width: 16, height: 9 },
      autoApproveGuests: false,
      logoInitials: input.venueName.slice(0, 2).toUpperCase(),
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
      tipPresets: [15, 20],
      defaultTipPct: 15,
    },
  });

  await logAdminAction(db, session, tenant.id, "provision_tenant", null, {
    name: input.venueName, city: input.city, plan: "starter", status: "trial",
  });

  return (await getTenant(db, tenant.id))!;
}

// ── Plan configs ────────────────────────────────────────────────────

export async function listPlanConfigs(db: PrismaClient): Promise<PlanConfig[]> {
  const rows = await db.planConfig.findMany({ orderBy: { monthlyPrice: "asc" } });
  return rows.map(toPlanConfig);
}

export async function updatePlanConfig(
  db: PrismaClient,
  id: TenantPlan,
  patch: Partial<Omit<PlanConfig, "id">>,
  session: AuthSession,
): Promise<PlanConfig | null> {
  const existing = await db.planConfig.findUnique({ where: { id } });
  if (!existing) return null;

  if (patch.monthlyPrice !== undefined && patch.monthlyPrice < 0) {
    throw new Error("Price must be zero or positive");
  }

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.monthlyPrice !== undefined) data.monthlyPrice = Math.round(patch.monthlyPrice * 100);
  if (patch.tagline !== undefined) data.tagline = patch.tagline;
  if (patch.highlight !== undefined) data.highlight = patch.highlight;
  if (patch.tableLimit !== undefined) data.tableLimit = patch.tableLimit;
  if (patch.staffLimit !== undefined) data.staffLimit = patch.staffLimit;
  if (patch.features !== undefined) data.features = patch.features;

  const row = await db.planConfig.update({ where: { id }, data });

  await logAdminAction(db, session, null, "update_plan_config", {
    id, monthlyPrice: existing.monthlyPrice, features: existing.features,
  }, { id, ...patch });

  return toPlanConfig(row);
}

// ── Telemetry links ─────────────────────────────────────────────────

export async function listTelemetryLinks(db: PrismaClient): Promise<TelemetryLink[]> {
  const rows = await db.telemetryLink.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toTelemetryLink);
}

export async function createTelemetryLink(
  db: PrismaClient,
  input: { name: string; url: string; category: string },
): Promise<TelemetryLink> {
  const row = await db.telemetryLink.create({ data: input });
  return toTelemetryLink(row);
}

export async function updateTelemetryLink(
  db: PrismaClient,
  id: string,
  patch: { name?: string; url?: string; category?: string },
): Promise<TelemetryLink | null> {
  const row = await db.telemetryLink.update({ where: { id }, data: patch }).catch(() => null);
  return row ? toTelemetryLink(row) : null;
}

export async function deleteTelemetryLink(db: PrismaClient, id: string): Promise<void> {
  await db.telemetryLink.delete({ where: { id } }).catch(() => {});
}

// ── Admin action audit log ──────────────────────────────────────────

export async function logAdminAction(
  db: PrismaClient,
  session: AuthSession,
  tenantId: string | null,
  action: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  await db.adminAction.create({
    data: {
      actorId: session.user.id,
      actorEmail: session.user.email,
      tenantId,
      action,
      before: before ? (before as Prisma.InputJsonValue) : Prisma.JsonNull,
      after: after ? (after as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}

export async function listAdminActions(
  db: PrismaClient,
  tenantId?: string,
  limit = 50,
): Promise<{ id: string; actorEmail: string; action: string; before: unknown; after: unknown; createdAt: string }[]> {
  const where = tenantId ? { tenantId } : {};
  const rows = await db.adminAction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    actorEmail: r.actorEmail,
    action: r.action,
    before: r.before,
    after: r.after,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ── Entitlement enforcement helpers ─────────────────────────────────

export async function checkEntitlement(
  db: PrismaClient,
  tenantId: string,
  feature: FeatureKey,
): Promise<{ allowed: boolean; upgrade?: TenantPlan }> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { allowed: false };

  const config = await db.planConfig.findUnique({ where: { id: tenant.plan } });
  if (!config) return { allowed: false };

  if (config.features.includes(feature)) return { allowed: true };

  const upgradeConfig = await db.planConfig.findFirst({
    where: { features: { has: feature } },
    orderBy: { monthlyPrice: "asc" },
  });
  return { allowed: false, upgrade: upgradeConfig?.id as TenantPlan | undefined };
}

export async function checkTableLimit(
  db: PrismaClient,
  tenantId: string,
): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { allowed: false, current: 0, limit: 0 };

  const config = await db.planConfig.findUnique({ where: { id: tenant.plan } });
  const tableLimit = config?.tableLimit ?? null;
  const current = await db.venueTable.count({ where: { venueId: tenantId } });

  if (tableLimit === null) return { allowed: true, current, limit: null };
  return { allowed: current < tableLimit, current, limit: tableLimit };
}

export async function checkStaffLimit(
  db: PrismaClient,
  tenantId: string,
): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { allowed: false, current: 0, limit: 0 };

  const config = await db.planConfig.findUnique({ where: { id: tenant.plan } });
  const staffLimit = config?.staffLimit ?? null;
  const current = await db.member.count({ where: { organizationId: tenantId } });

  if (staffLimit === null) return { allowed: true, current, limit: null };
  return { allowed: current < staffLimit, current, limit: staffLimit };
}
