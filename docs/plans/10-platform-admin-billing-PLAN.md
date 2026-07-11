# 10 — Platform Admin & Billing · PLAN

Goal: the cross-tenant context — leads, tenant management, the provisioning job,
and Stripe subscription billing (R9). Last because it monetizes what the other
plans built, and touching Stripe before the product works is cart-before-horse.

Preconditions: plan 02 (platform role, unscoped client). Provisioning exercises
plans 03–06 output.

## Reasoning

This context lives on the **unscoped** persistence path (`src/server/platform/`,
AD-3) with its own authorization (`requirePlatformAdmin`). The provisioning job is
the integration test of the whole migration: it must produce a tenant whose
manager can onboard and take an order using only the features plans 02–08 shipped.

## Design choices

- **Schema (platform tables)**: `Lead` + `LeadActivity` (append-only), `Tenant`
  extensions (stripeCustomerId, stripeSubscriptionId, plan, status), `Invite`
  reused from plan 02.
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
- **Plan limits enforced** where they bite: table/staff creation in the scoped
  services check the tenant's plan (403 with upgrade hint) — small retrofits to
  plans 02/03 services, listed here because the limits only exist now.
- **Suspension** actually locks: middleware (plan 02) gains a tenant-status check
  — suspended venue's staff get a "venue suspended" screen.

## Implementation strategy

1. Platform schema + migration; move admin-service reads/writes to
   `src/server/platform/` handlers; swaps: leads CRUD/activity → tenant list/
   update/delete → provisioning transaction + email.
2. Lead capture route + rate limit + notification.
3. Stripe: products/prices setup script, checkout + portal links, webhook handler
   (signature-verified), Tenant sync, `billingService` swap.
4. Enforcement retrofits: plan limits, suspension middleware.
5. Renames (`adminService`, `billingService`); delete consumed TODOs (admin,
   billing, subscription, pricing, lead).

## Testing

- Unit: webhook event → Tenant state mapping matrix; plan-limit calculator.
- Integration: provisioning idempotency (rerun = no dupes); platform routes 403
  for venue managers (the inverse isolation test); webhook with bad signature
  rejected; suspension blocks staff session but not platform admin; limit
  enforcement at the boundary (table N+1 rejected).
- E2E: **the graduation flow** — admin moves lead to won → provisions → invite
  email → manager accepts, onboards, creates a table, guest orders on it. Green
  = the whole Phase 2 loop closes.

## Review checklist

- Webhook handler idempotent under Stripe's at-least-once delivery?
- Any scoped-context import of platform modules (ESLint rule from plan 01 holds)?
- Trial-without-card path can't reach "active" without a subscription?

## Exit criteria

Graduation E2E green in preview with Stripe test mode; demo admin password gate
long gone (plan 02) and `/admin` fully real; ROADMAP marked complete and AGENTS.md
Phase-1 appendix pruned (§9.9).
