/**
 * mockAdminService — future backend boundary for platform administration.
 * TODO(backend): leads/tenants live in a platform-level schema; provisioning
 * becomes a job that creates the tenant DB schema + default venue.
 */
import type { Lead, LeadActivity, LeadStatus, Tenant, TenantPlan, TenantStatus } from "@/lib/types";
import { mockLeads, mockTenants } from "@/lib/mock-data/admin";
import { clone, delay, uid } from "./delay";

let leads: Lead[] = clone(mockLeads);
let tenants: Tenant[] = clone(mockTenants);

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

const PLAN_MRR: Record<TenantPlan, number> = { starter: 99, pro: 249, enterprise: 599 };

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

  async updateTenant(
    tenantId: string,
    patch: Partial<Pick<Tenant, "plan" | "status" | "venueName" | "city">>,
  ): Promise<Tenant | null> {
    await delay(400);
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) return null;
    Object.assign(tenant, patch);
    // MRR follows the plan; trials and suspensions don't bill.
    tenant.monthlyRevenue = tenant.status === "active" ? PLAN_MRR[tenant.plan] : 0;
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
      tableCount: 0,
      monthlyRevenue: 0,
      createdAt: new Date().toISOString(),
    };
    tenants = [tenant, ...tenants];
    return clone(tenant);
  },

  /** Full onboarding: creates the tenant from the wizard config. */
  async onboardTenant(config: OnboardingConfig): Promise<Tenant> {
    // TODO(backend): provisioning job — tenant schema, venue, zones/tables,
    // menu seed, fee config, manager invite email.
    await delay(1500);
    const tenant: Tenant = {
      id: uid("ten"),
      venueName: config.venueName,
      slug: config.venueName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      plan: config.plan,
      status: config.startOnTrial ? "trial" : "active",
      city: config.city,
      tableCount: config.zones.reduce((sum, z) => sum + z.tableCount, 0),
      monthlyRevenue: config.startOnTrial ? 0 : PLAN_MRR[config.plan],
      createdAt: new Date().toISOString(),
    };
    tenants = [tenant, ...tenants];
    if (config.leadId) {
      const lead = leads.find((l) => l.id === config.leadId);
      if (lead) logActivity(lead, `Onboarded as tenant "${tenant.venueName}"`);
    }
    return clone(tenant);
  },
};
