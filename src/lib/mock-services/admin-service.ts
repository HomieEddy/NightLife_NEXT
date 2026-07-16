/**
 * mockAdminService — demo-track platform administration. The live counterpart
 * uses admin-core.ts with Postgres (platform-level schema, provisioning job).
 */
import type {
  Lead, LeadActivity, LeadStatus, PlanConfig, TelemetryLink, Tenant, TenantPlan,
} from "@/lib/types";
import { DEFAULT_PLAN_CONFIGS, tenantMrr } from "@/lib/plan-catalog";
import { mockLeads, mockTelemetryLinks, mockTenants } from "@/lib/mock-data/admin";
import { clone, delay, uid } from "./delay";

let leads: Lead[] = clone(mockLeads);
let tenants: Tenant[] = clone(mockTenants);
const planConfigs: PlanConfig[] = clone(DEFAULT_PLAN_CONFIGS);
let telemetryLinks: TelemetryLink[] = clone(mockTelemetryLinks);

/**
 * Sync read for the billing mock — plan state lives here only, so admin edits
 * propagate to subscription/pricing consumers without a second store.
 */
export function getPlanConfigsSync(): PlanConfig[] {
  return clone(planConfigs);
}

function logActivity(lead: Lead, text: string) {
  const entry: LeadActivity = { id: uid("act"), at: new Date().toISOString(), text };
  lead.activity = [...lead.activity, entry];
}

/** Zone blueprint used by the onboarding wizard's floor-setup step. */
export interface OnboardingZone {
  name: string;
  color: string;
  tableCount: number;
}

export interface OnboardingConfig {
  venueName: string;
  city: string;
  address: string;
  timezone: string;
  currency: string;
  plan: TenantPlan;
  startOnTrial: boolean;
  zones: OnboardingZone[];
  menuCategories: string[];
  serviceFees: { name: string; type: "percentage" | "flat"; value: number }[];
  managerName: string;
  managerEmail: string;
  leadId?: string; // set when onboarding a won lead
}

export const mockAdminService = {
  // ---------- Leads ----------

  async listLeads(): Promise<Lead[]> {
    await delay();
    return clone(leads).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createLead(
    input: Omit<Lead, "id" | "status" | "activity" | "createdAt">,
  ): Promise<Lead> {
    await delay(600);
    const lead: Lead = {
      id: uid("lead"),
      status: "new",
      activity: [],
      createdAt: new Date().toISOString(),
      ...input,
    };
    logActivity(lead, "Lead created manually");
    leads = [lead, ...leads];
    return clone(lead);
  },

  async updateLead(
    leadId: string,
    patch: Partial<Omit<Lead, "id" | "activity" | "createdAt">>,
  ): Promise<Lead | null> {
    await delay(400);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return null;
    Object.assign(lead, patch);
    return clone(lead);
  },

  async deleteLead(leadId: string): Promise<void> {
    await delay(300);
    leads = leads.filter((l) => l.id !== leadId);
  },

  async setLeadStatus(leadId: string, status: LeadStatus): Promise<Lead | null> {
    await delay(300);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return null;
    const previous = lead.status;
    lead.status = status;
    logActivity(lead, `Stage: ${previous} → ${status}`);
    return clone(lead);
  },

  async addLeadNote(leadId: string, text: string): Promise<Lead | null> {
    await delay(300);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return null;
    logActivity(lead, text);
    return clone(lead);
  },

  async getLead(leadId: string): Promise<Lead | null> {
    await delay(200);
    return clone(leads.find((l) => l.id === leadId) ?? null);
  },

  // ---------- Tenants ----------

  async listTenants(): Promise<Tenant[]> {
    await delay();
    return clone(tenants);
  },

  async getTenant(tenantId: string): Promise<Tenant | null> {
    await delay(200);
    return clone(tenants.find((t) => t.id === tenantId) ?? null);
  },

  async updateTenant(
    tenantId: string,
    patch: Partial<Pick<Tenant, "plan" | "status" | "venueName" | "city">>,
  ): Promise<Tenant | null> {
    await delay(400);
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) return null;
    Object.assign(tenant, patch);
    // MRR follows the plan; trials and suspensions don't bill.
    tenant.mrr = tenantMrr(tenant.plan, tenant.status, planConfigs);
    return clone(tenant);
  },

  async deleteTenant(tenantId: string): Promise<void> {
    await delay(500);
    tenants = tenants.filter((t) => t.id !== tenantId);
  },

  /** Quick-provision from the tenants page — trial with defaults. */
  async provisionVenue(input: { venueName: string; city: string }): Promise<Tenant> {
    await delay(1200);
    const tenant: Tenant = {
      id: uid("ten"),
      venueName: input.venueName,
      slug: input.venueName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      plan: "starter",
      status: "trial",
      city: input.city,
      mrr: 0,
      metrics: emptyMetrics(),
      staff: [],
      provisioning: defaultProvisioningSnapshot(),
      createdAt: new Date().toISOString(),
    };
    tenants = [tenant, ...tenants];
    return clone(tenant);
  },

  /** Full onboarding: creates the tenant from the wizard config. */
  async onboardTenant(config: OnboardingConfig): Promise<Tenant> {
    // Live counterpart: provisionTenant() in admin-core.ts creates the
    // tenant, org, venue and default zone via the platform DB.
    await delay(1500);
    const status = config.startOnTrial ? "trial" : "active";
    const tenant: Tenant = {
      id: uid("ten"),
      venueName: config.venueName,
      slug: config.venueName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      plan: config.plan,
      status,
      city: config.city,
      mrr: tenantMrr(config.plan, status, planConfigs),
      metrics: {
        ...emptyMetrics(),
        tableCount: config.zones.reduce((sum, z) => sum + z.tableCount, 0),
        zoneCount: config.zones.length,
        staffCount: 1, // the invited manager
      },
      staff: [{ id: uid("ts"), name: config.managerName, role: "manager", email: config.managerEmail }],
      provisioning: {
        timezone: config.timezone,
        currency: config.currency,
        serviceFees: config.serviceFees.map((f) => ({ ...f })),
        menuCategories: [...config.menuCategories],
      },
      createdAt: new Date().toISOString(),
    };
    tenants = [tenant, ...tenants];
    if (config.leadId) {
      const lead = leads.find((l) => l.id === config.leadId);
      if (lead) logActivity(lead, `Onboarded as tenant "${tenant.venueName}"`);
    }
    return clone(tenant);
  },

  // ---------- Plan configuration ----------

  async getPlanConfigs(): Promise<PlanConfig[]> {
    await delay(200);
    return clone(planConfigs);
  },

  async updatePlanConfig(
    id: TenantPlan,
    patch: Partial<Omit<PlanConfig, "id">>,
  ): Promise<PlanConfig | null> {
    await delay(500);
    const config = planConfigs.find((c) => c.id === id);
    if (!config) return null;
    if (patch.monthlyPrice !== undefined && patch.monthlyPrice < 0) {
      throw new Error("Price must be zero or positive");
    }
    Object.assign(config, patch);
    // MRR of every tenant follows its plan's price.
    for (const tenant of tenants) {
      tenant.mrr = tenantMrr(tenant.plan, tenant.status, planConfigs);
    }
    return clone(config);
  },

  // ---------- Telemetry links ----------

  async listTelemetryLinks(): Promise<TelemetryLink[]> {
    await delay(200);
    return clone(telemetryLinks);
  },

  async createTelemetryLink(input: Omit<TelemetryLink, "id">): Promise<TelemetryLink> {
    await delay(400);
    const link: TelemetryLink = { id: uid("tel"), ...input };
    telemetryLinks = [...telemetryLinks, link];
    return clone(link);
  },

  async updateTelemetryLink(
    id: string,
    patch: Partial<Omit<TelemetryLink, "id">>,
  ): Promise<TelemetryLink | null> {
    await delay(400);
    const link = telemetryLinks.find((l) => l.id === id);
    if (!link) return null;
    Object.assign(link, patch);
    return clone(link);
  },

  async deleteTelemetryLink(id: string): Promise<void> {
    await delay(300);
    telemetryLinks = telemetryLinks.filter((l) => l.id !== id);
  },
};

function emptyMetrics() {
  return {
    orderCount30d: 0,
    sessionCount30d: 0,
    tableCount: 0,
    staffCount: 0,
    zoneCount: 0,
    lastActivityAt: new Date().toISOString(),
  };
}

function defaultProvisioningSnapshot() {
  return {
    timezone: "America/Toronto",
    currency: "CAD",
    serviceFees: [{ name: "Service", type: "percentage" as const, value: 5 }],
    menuCategories: ["Bottles", "Cocktails", "Beer & Wine", "Soft drinks"],
  };
}
