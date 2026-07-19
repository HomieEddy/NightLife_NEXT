# 10 — Platform Admin & Billing · PLAN

**Status: complete.**

Goal: the cross-tenant context — leads, tenant management, the provisioning job,
Stripe subscription billing (R9), and the platform **control center**: per-tenant
operational visibility, dynamic plan/entitlement configuration, telemetry
shortcuts, and the hardened admin security posture. Last because it monetizes
what the other plans built, and touching Stripe before the product works is
cart-before-horse.

Preconditions: plan 02 (platform role, unscoped client). Provisioning exercises
plans 03–06 output. The control-center demo track (tenant detail, plan builder,
telemetry links) ships mock-first ahead of graduation per AD-14.

## Reasoning

This context lives on the **unscoped** persistence path (`src/server/platform/`,
AD-3) with its own authorization (`requirePlatformAdmin`). The provisioning job is
the integration test of the whole migration: it must produce a tenant whose
manager can onboard and take an order using only the features plans 02–08 shipped.

The admin area is also the platform's highest-privilege surface: it reads across
every tenant and writes plan/status/entitlement state that changes what tenants
pay and what features they see. Two consequences drive the design: (1) a strict
privacy line between *operational* visibility and tenant *business* data, and
(2) the most defensive auth posture in the app.

## Design choices

- **Schema (platform tables)**: `Lead` + `LeadActivity` (append-only), `Tenant`
  extensions (stripeCustomerId, stripeSubscriptionId, plan, status), `Invite`
  reused from plan 02. New: `PlanConfig` (one row per tier, seeded from
  `DEFAULT_PLAN_CONFIGS` in `src/lib/plan-catalog.ts`), `TelemetryLink`
  (platform settings), `AdminAction` (append-only audit log of tenant
  mutations: actor, tenant, action, before/after plan/status, timestamp).
- **Control center**: `/admin/venues/[id]` is the per-tenant detail — plan/status
  controls, provisioning settings snapshot, staff roster, and operational metric
  tiles. Live metrics come from real scoped SQL counts (the `analytics-core`
  style: `db.venueTable.count`, order/session counts over 30d) aggregated per
  tenant by an unscoped platform query.
  **INV-P2: the admin surface never displays a tenant's sales/revenue amounts —
  only MRR (what the tenant pays the platform) and operational counts (orders,
  sessions, tables, staff, zones).** Any platform aggregation that would expose
  order totals or item revenue is out of bounds.
- **Entitlements are the single plan source of truth.**
  `src/lib/plan-catalog.ts` holds the feature catalog (one key per gateable nav
  module), `DEFAULT_PLAN_CONFIGS`, and pure helpers (`hasFeature`,
  `planLimits`). Demo track: the admin mock owns a mutable copy the plan-builder
  page edits. Live track: a `PlanConfig` table seeded from the defaults; the
  admin plan builder edits rows; Stripe Prices are keyed on `PlanConfig.id`
  (INV-P1 still holds — a tenant's *billing* derives from its Stripe
  subscription; `PlanConfig` defines what each tier contains and costs).
  Consumers: public pricing cards, `/manager/subscription` cards, nav gating in
  manager/staff shells, and server-side enforcement. Enforcement is
  **server-side first**: scoped services reject writes/reads for unentitled
  features (403 with upgrade hint); client gating (nav filter + `FeatureGate`
  upgrade cards) is UX, not security. This generalizes the old "plan limits"
  bullet — `tableLimit`/`staffLimit` are just numeric entitlements on the same
  config.
- **Telemetry shortcuts**: admin-editable `TelemetryLink` list (name, url,
  category) rendered as external chips on the admin overview/nav. Links only —
  no embedded metrics; observability stays in Sentry/Grafana/etc.
- **Lead capture** (`/lead` TODO): public route handler with rate limiting +
  honeypot; notifies sales via Resend (email now; Slack webhook is a config-later
  stub).
- **Provisioning becomes a real job** (admin-service TODO): transaction creating
  Tenant → Venue (defaults) → manager Invite → email. Idempotent on retry
  (unique on tenant slug). Won-lead handoff writes the LeadActivity entry as
  today.
- **Billing** per AD-12: plans map to Stripe Prices (test mode in dev/preview).
  Tenant page's "Provision" defaults to trial without a card; Stripe Checkout
  link sent to the manager for conversion; the manager's `/manager/subscription`
  page swaps its mock for the customer-portal link + live subscription read.
  Webhooks (`checkout.session.completed`, `customer.subscription.updated/deleted`,
  `invoice.*`) sync the Tenant row; INV-P1: MRR/limits derive from the
  subscription, admin edits go through Stripe, not the row.
- **Suspension** actually locks: middleware (plan 02) gains a tenant-status check
  — suspended venue's staff get a "venue suspended" screen.
- **Security hardening (the admin area is the most locked-down surface):**
  - Every `/api/platform/*` handler calls `requirePlatformAdmin()`
    (`src/server/auth-helpers.ts`); the `/admin` layout becomes a server
    component calling it too (mirror of `requireArea()` on manager/staff).
  - `src/proxy.ts`: in live mode `/admin` currently 404s; at graduation it
    requires a session cookie (missing → `/login`), with the layout doing the
    platform-role check. Non-admin authenticated users get
    `/login?error=forbidden`, never a 200.
  - Platform-admin accounts: Better Auth credentials only — no shared demo
    password (the demo gate dies with plan 02's graduation). Password reset via
    Better Auth flow; strong-password policy enforced at signup/reset; platform
    admins are created by seed/script, never by public signup.
  - Rate limiting: `/api/lead` and all `/api/platform/*` mutations get a token
    bucket per IP + per session.
  - Every tenant mutation (plan change, suspend, delete, provision, plan-config
    edit) appends an `AdminAction` row. The log is append-only and readable
    from the tenant detail page.

## Implementation strategy

Demo track (ships first, mock-first per AD-14 — no backend work):

1. Entitlement foundation: `plan-catalog.ts`, `PlanConfig`/`FeatureKey`/
   `TelemetryLink`/`TenantMetrics` types, admin+billing mock methods,
   `useEntitlements()` hook.
2. Plan builder page (`/admin/plans`) + propagation: pricing cards,
   subscription cards, nav gating, `FeatureGate` upgrade cards.
3. Tenant control center (`/admin/venues/[id]`) with seeded metrics/staff;
   overview aggregates + telemetry chips; platform settings page
   (`/admin/settings`) for telemetry links.

Live track (graduation):

4. Platform schema + migration (incl. `PlanConfig`, `TelemetryLink`,
   `AdminAction`); move admin-service reads/writes to `src/server/platform/`
   handlers; swaps: leads CRUD/activity → tenant list/update/delete → plan
   configs + telemetry links → tenant metrics aggregation → provisioning
   transaction + email.
5. Lead capture route + rate limit + notification.
6. Stripe: products/prices setup script (keyed on PlanConfig), checkout +
   portal links, webhook handler (signature-verified), Tenant sync,
   `billingService` swap.
7. Enforcement retrofits: entitlement checks + plan limits in scoped services,
   suspension middleware, proxy admin guard, platform rate limits, AdminAction
   audit writes.
8. Renames (`adminService`, `billingService`); delete consumed TODOs (admin,
   billing, subscription, pricing, lead).

## Testing

- Unit: webhook event → Tenant state mapping matrix; plan-limit calculator;
  **entitlement matrix (every plan × every FeatureKey against `hasFeature`)**;
  plan-config validation (core features locked on, price ≥ 0).
- Integration: provisioning idempotency (rerun = no dupes); platform routes 403
  for venue managers (the inverse isolation test); webhook with bad signature
  rejected; suspension blocks staff session but not platform admin; limit
  enforcement at the boundary (table N+1 rejected); **unentitled feature
  endpoint returns 403 with upgrade hint; rate limiter returns 429 past the
  bucket; tenant mutation writes an AdminAction row**.
- E2E: **the graduation flow** — admin moves lead to won → provisions → invite
  email → manager accepts, onboards, creates a table, guest orders on it. Green
  = the whole Phase 2 loop closes. Plus: admin removes a feature from a tier →
  that tenant's nav loses the module and its API rejects.

## Review checklist

- Webhook handler idempotent under Stripe's at-least-once delivery?
- Any scoped-context import of platform modules (ESLint rule from plan 01 holds)?
- Trial-without-card path can't reach "active" without a subscription?
- INV-P2 holds: no tenant sales/revenue figure reachable from any admin surface?
- Entitlement enforcement server-side, not just nav hiding?
- Plan definitions exist in exactly one place (`plan-catalog` defaults / DB rows)?

## Exit criteria

Graduation E2E green in preview with Stripe test mode; demo admin password gate
long gone (plan 02) and `/admin` fully real; ROADMAP marked complete and AGENTS.md
Phase-1 appendix pruned (§9.9).
