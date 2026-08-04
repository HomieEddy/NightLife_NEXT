# 35 — Compliance & Privacy (Law 25 / PIPEDA) · PLAN

**Status: live (~85%) — ROADMAP Phase 8. Residuals: consent touchpoints on forms, tenant offboarding, breach register content.**
**Renumbered 2026-07-30:** was plan 29; the old number is retired.

Goal: make the product legally operable in Quebec: Law 25 and PIPEDA
obligations mapped to concrete features and documents — published privacy
policy and ToS, consent at collection points, data inventory and retention
with an enforcement job, account/tenant deletion, and an incident-response
procedure. Staging can run without this; **production cannot onboard a real
venue before it** — that's the gate this plan defines.

Preconditions: plan 25 (**live** — the retention job rides the existing
`/api/jobs/*` + `CRON_SECRET` + `JobRun` pattern, alongside nightly-rollup,
report-schedules and reservation-reminders; breach notification uses the
email channel) and plan 34 (the policy pages render through its locale
plumbing). Legal-document *review* by an actual
lawyer is recommended and explicitly outside what code review can approve.
Branch `feature/35-compliance-privacy`.

## Reasoning

What personal information does this system actually hold? The inventory is
the foundation of everything else, and a first pass from the schema:

- **Venue staff:** name, email, phone (User/Member/StaffProfile) — B2B
  employment context.
- **Guests:** transient QR sessions; reservations carry `guestName`,
  `guestEmail`, `guestPhone`, PIN (plans 08/13); orders tie to sessions.
  Guests are the volume and the sensitivity: consumers, not businesses.
- **Guest profiles (plan 17, live):** the heaviest class and the one the
  original inventory understated — persistent identity with photo
  (`photoUrl`), staff notes, linked profiles, preferences, visit/spend
  history, watchlist tier, bans and refusals, plus **incident records**
  naming guests, staff and witnesses. Some of this is arguably sensitive
  personal information under Law 25 (health details in the medical
  checklist, biometrically-adjacent photos, allegations of misconduct) and
  needs its own retention line, its own consent/transparency statement, and
  the tightest deletion path.
- **Door & safety (plan 17, live):** admissions with age verification (DOB),
  denied entries, ejections, evacuation headcounts, coat check, lost items.
- **Staff operational data (plan 18, live):** time entries, breaks, shift
  records, tip distributions, commission statements — employment records
  with their own statutory retention (Quebec labour law), which is *longer*
  than the privacy-minimization instinct; do not let the retention job
  shorten it.
- **Leads:** contact info from the public form (plan 10).
- **Derived:** `NotificationLog` recipients (plan 25/26), `AuditEntry`
  (plan 10/16), `JobRun`, auth + request logs (plan 32), error-tracker
  payloads (plan 32 — see its residency caveat), backups (plan 33).

Law 25's teeth relevant at this scale: a designated privacy officer
(published contact), transparency at collection (state purpose, no
dark-pattern consent), the right to deletion/portability, breach
register + notification to the CAI when there's risk of serious injury, and
privacy-by-default settings. PIPEDA overlaps; complying with Law 25's
stricter posture covers the federal side for this product's reality. The
architecture already leans right — minimal collection, no ad trackers, no
third-party analytics, cookies limited to session mechanics — so the plan
is mostly about *stating* what's true, *enforcing* retention, and building
the deletion path.

Out of scope: GDPR (no EU market yet — noted for the day it changes), DPO
tooling/DSAR portals (a mailbox + runbook procedure suffices at this
volume), cookie consent banners (no non-essential cookies exist — adding a
banner would be cargo cult; documented in the policy instead).

## Design choices

- **Documents, versioned in-repo** (`docs/legal/` as markdown source of
  truth, rendered at `/privacy` and `/terms` on the live marketing build;
  the demo build links to the live URLs per the cross-link pattern):
  privacy policy (bilingual FR/EN — Quebec-facing consumer text should
  lead French), ToS for venue customers, and the internal data inventory
  + retention schedule (`docs/legal/DATA-INVENTORY.md` — per data class:
  what, why, where, how long, lawful basis, deletion path).
- **Consent at collection, not blanket checkboxes:** signup and lead forms
  get a purpose statement + policy link + affirmative checkbox; the public
  reservation form states what the email/phone are used for (confirmation
  + PIN — plan 26 wrote the field copy; this plan makes it policy-linked).
  Guest QR join collects nothing identifying beyond the session — stated
  in the policy as the privacy-by-default posture.
- **Retention enforced by a cron job**, not by promise:
  `/api/jobs/data-retention` (the shipped pattern: `CRON_SECRET` bearer,
  `JobRun` row, idempotent — copy `nightly-rollup/route.ts`) applying the
  inventory's schedule — e.g. closed guest
  sessions and their PII-bearing fields anonymized after N days (aggregates
  and rollups keep the numbers, lose the person — analytics, plan 09/09c,
  must survive anonymization by design: verify rollups don't join back to
  guest identity), stale leads purged, `NotificationLog` recipients
  truncated after M days, auth logs per plan 32's retention. N/M values
  proposed in the inventory, decided by the owner, recorded there.
- **Deletion paths, two shapes:**
  - **Soft-delete is not erasure.** `features/guests/core.ts` already ships
    a CRM-07 profile *soft* delete (covered by an integration test). That
    satisfies an operator's "remove this guest from my list"; it does not
    satisfy a Law 25 erasure request, which must also reach notes,
    incidents-by-reference, photos, notification logs and reservations.
    State the distinction in the inventory and make the erase script the
    hard path.
  - **Individual (staff user or guest request):** a documented DSAR
    procedure (RUNBOOK.md §privacy-requests: verify identity → locate via
    email/phone across the inventory → delete/anonymize → confirm within
    30 days) plus a `scripts/privacy-erase.ts` admin script doing the
    mechanical part. No self-serve UI yet — request volume won't justify
    it; the script keeps the 30-day clock honest.
  - **Tenant offboarding:** plan 10's admin area gains a
    confirm-dialog-gated tenant deletion — no such method exists in
    `features/platform/` today, so this is new service + route + UI, and
    per AGENTS.md §4.8 it needs all three. It cascades the venue's data
    (schema hangs everything off `venueId`, **except** the models on
    `getDb()`'s `platformModels` list and the child tables scoped through a
    parent FK — `IncidentNote`, `SupplierItem`, `AttentionAcknowledgment` —
    which the cascade must reach through their parents). Grace-period
    soft-disable first (export window for the venue), then hard delete
    including a note that backups age out per plan 33's retention — stated
    honestly in the ToS.
- **Breach procedure:** `docs/RUNBOOK.md` §incident-response (the ops
  runbook plan 32 creates — distinct from the in-app *venue* incident
  workflow of plan 17, and distinct from `RUNBOOK-VPS-SETUP.md`) — contain, assess
  "risk of serious injury", CAI + affected-person notification templates,
  and the Law 25-required internal breach register
  (`docs/legal/BREACH-REGISTER.md`, empty but existing). Privacy officer
  named there and in the policy (the owner, until there's a team).

## Implementation strategy

1. Data inventory first — walk `prisma/schema.prisma` model by model (it is
   the source of truth now that every service is live) plus the new stores
   from plans 31–33 (auth/request logs, error tracker, backups); owner signs
   off retention numbers, including the *longer* statutory floors for
   employment records.
2. Privacy policy + ToS drafts (FR/EN) from the inventory; `/privacy` and
   `/terms` pages on the live build; footer links; demo cross-links.
3. Consent touchpoints: signup, lead, public reservation forms — purpose
   copy + checkbox where consent (vs. contract necessity) is the basis.
4. Retention job + anonymization migrations; verify analytics survive.
5. `privacy-erase.ts` + RUNBOOK DSAR procedure; tenant offboarding flow in
   `/admin` (ConfirmDialog per §4.5, grace period, cascade).
6. Breach register + incident procedure; officer designation in policy.
7. External legal review pass (tracked as a task; findings folded into the
   docs in a follow-up commit).

## Testing

- Unit: anonymization helpers (guest fields scrubbed, aggregates intact).
- Integration (PGlite): retention job idempotent, scoped, and correct —
  seeded old sessions anonymized, fresh ones untouched; rollup numbers
  identical before/after anonymization; tenant cascade deletes every
  `venueId`-scoped table (walk the schema in the test, so a future model
  missing from the cascade fails the suite); erase script removes a
  guest's traces across reservations/logs.
- Behavioral (§5): live build shows `/privacy`, `/terms`, consent
  checkboxes block submission until checked; admin offboarding flow driven
  end-to-end on staging with a test venue; demo build unaffected (no
  consent friction in the sandbox — it collects nothing real).

## Review checklist

- Every PII-bearing table appears in the inventory; the cascade test
  enumerates from the schema, not a hand-kept list.
- French text is real French, not machine-glossed English (owner reads it).
- Retention numbers are decided-and-recorded, not "TBD".
- Anonymization preserves the analytics contract (plan 09c metrics
  spot-checked pre/post).
- No consent dark patterns: unchecked by default, no bundling of
  necessary-service consent with anything optional.
- ToS honestly states backup-tail deletion timing (plan 33 retention).

## Exit criteria

Live build publishes the bilingual policy and ToS with consent wired at
every collection point; the retention job provably anonymizes on schedule
without breaking analytics; a guest or staff erasure request is executable
within the documented procedure; a tenant can be offboarded with full
cascade; breach register and incident procedure exist with a named privacy
officer — the checklist's compliance rows check, and production onboarding
of a real venue is unblocked from the legal side.
