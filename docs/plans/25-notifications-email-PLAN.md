# 25 — Notification Core & Email (Resend) · PLAN

**Status: not started.**

Goal: ship the notification layer the architecture already promised (AD-8
Resend + React Email, AD-9 platform cron + idempotent jobs) and use it to
close the one unshipped leg of plans 09/09c — scheduled report email — plus
the email sends other features have been faking: staff invites (today a
copyable link), reservation confirmations (plan 08/13), and lead
acknowledgements. SMS (plan 26) and web push (plan 28) plug into the same
dispatch layer; this plan builds the socket they plug into.

Preconditions: plans 02 (Better Auth invites), 08/13 (reservations), 09/09c
(report engine stores `schedule`, computes due-selection; `computeRollup`/
`upsertRollup`; `job_runs` table) — all complete. Branch
`feature/25-notifications-email`.

## Reasoning

Three forces converge on one plan:

1. **The parked debt.** ROADMAP's footnote: report schedules and rollups are
   fully computed but nothing invokes them — no `/api/jobs/*` handler, no
   sender. The infrastructure (due-selection, `job_runs`) was built to be
   called; this plan calls it.
2. **The channel question.** Plans 26 (SMS) and 21 (push) each need "given a
   domain event, deliver a message to a recipient over a channel, record the
   attempt, never double-send". Building that three times would be the
   parallel-seam mistake AGENTS.md §1.2 warns about. So this plan ships a
   small dispatch core (`src/server/notifications/`) with email as the first
   channel; 19 and 21 add channels, not layers.
3. **Track placement.** This is live-track work: email is a real-world side
   effect with no demo-mode analog. The demo build never sends anything —
   the demo resource guard already rejects HTTP from demo mode, and every
   entry point here is server-side. No `isDemoMode()` UI gating needed
   because no UI changes modes; demo staff invites keep surfacing as
   copyable links (that behavior becomes the demo simulation, gated where it
   diverges).

What this plan is **not**: no marketing email, no user-facing notification
preferences UI (deferred until a second preference exists to justify it), no
queue infrastructure (BullMQ/Redis) — sends are synchronous route-handler or
cron work at this scale; a queue is earned when send volume or retry
complexity demands it. Note the deferral in a `TODO(backend)`.

## Design choices

- **`src/server/notifications/` layout:**
  - `dispatch.ts` — `notify(event, recipients, payload)`: resolves channels
    per recipient (email now; SMS/push later read the same registration),
    calls each transport, records one `NotificationLog` row per attempt
    (venueId, channel, template, recipient, status, providerId, error).
    Append-only; the log is the audit trail and the idempotency check.
  - `email.ts` — thin Resend transport. `EMAIL_DRIVER=resend|log`: `log`
    (default in dev/test) writes the rendered payload to stdout so local and
    CI runs need no API key; staging/prod set `resend`. Missing
    `RESEND_API_KEY` under `resend` fails configuration at boot, same
    fail-closed pattern as `QR_TOKEN_SECRET`.
  - `src/emails/*.tsx` — React Email templates: `staff-invite`,
    `reservation-confirmation` (includes the plan-13 PIN when present),
    `report-run` (summary + CSV attachment), `lead-acknowledgement`.
    Branding follows the plan-11 luxe tokens, dark-safe.
- **Cron: system cron on the VPS hitting authenticated routes** (AD-9,
  AD-15). Two handlers: `POST /api/jobs/report-schedules` (finds due
  schedules, runs each report, emails recipients) and
  `POST /api/jobs/nightly-rollup` (per-venue `computeRollup`/`upsertRollup`
  after night end). Both require `Authorization: Bearer ${CRON_SECRET}`,
  record a `job_runs` row keyed by (job, logical date) and **no-op if that
  key already succeeded** — rerunning is always safe. Coolify scheduled
  tasks (or plain crontab + curl) trigger them; the schedule lives in
  deployment config, documented in HOSTING.md.
- **Send points wired in this plan:** staff invite email on invite create and
  on `/api/staff/[id]/resend` (link stays visible in the dialog as fallback);
  reservation confirmation on `confirmed` transition when `guestEmail`
  exists; scheduled report runs; lead form acknowledgement + internal
  notification. Guest receipts deferred — guests are ephemeral and rarely
  give email; note as `TODO(backend)` at the session-close seam.
- **Types first:** `NotificationLog` model in Prisma + `types.ts`
  re-export, per §3. `venueId` scoping enforced like every tenant model;
  platform-level sends (lead ack) use the platform-null convention plan 10
  established.
- **Email addresses are PII** — never logged in plaintext app logs (plan 23
  redaction covers this); `NotificationLog.recipient` is the one sanctioned
  store, subject to plan 29 retention.

## Implementation strategy

1. Prisma: `NotificationLog` model + migration; `types.ts` derives.
2. `email.ts` transport + `EMAIL_DRIVER` config validation; unit tests with
   the `log` driver.
3. Templates in `src/emails/` (React Email); snapshot-free — render tests
   assert key content (PIN present, report name, invite URL), not markup.
4. `dispatch.ts` + `NotificationLog` writes; idempotency helper.
5. Cron handlers `/api/jobs/report-schedules` and `/api/jobs/nightly-rollup`
   with `CRON_SECRET` auth + `job_runs` idempotency; delete the fulfilled
   `TODO(backend)` markers in report/rollup code in the same commits.
6. Wire the four send points; staff invite path keeps the copyable link.
7. Docs: HOSTING.md cron section; `.env.example` gains `RESEND_API_KEY`,
   `EMAIL_FROM`, `EMAIL_DRIVER`, `CRON_SECRET`.

## Testing

- Unit: dispatch resolves channels and writes exactly one log row per
  attempt; idempotency (same job key twice → one send); template renders
  contain PIN / invite URL / report name; `EMAIL_DRIVER` misconfig fails
  boot.
- Integration (PGlite): cron route rejects missing/wrong bearer (401);
  due-schedule selection sends and records `job_runs`; rerun same logical
  date → no duplicate; `expectTenantIsolation()` on `NotificationLog`
  queries; wrong-role 403 on any manager-facing notification read.
- Behavioral (§5): `dev:pglite` with `EMAIL_DRIVER=log` — create a staff
  invite, confirm a reservation with an email + PIN, trigger the cron route
  with curl; verify stdout payloads and `job_runs` rows. Staging smoke with
  real Resend onto a test inbox before the release PR.

## Review checklist

- No send path reachable from demo mode (server-only entry points; resource
  guard would throw — verify by grep, not assumption).
- Every send records a `NotificationLog` row, including failures.
- Cron handlers idempotent under the (job, date) key — two curls, one send.
- `TODO(backend)` markers for AD-8/AD-9 deleted in the fulfilling commits.
- No email address in app logs or error messages.
- Rollup timing uses venue timezone/night config — no Toronto/18:00 fallback.

## Exit criteria

A due report schedule emails its recipients a CSV via a cron-triggered,
idempotent, `job_runs`-recorded handler; staff invites and reservation
confirmations (with PIN) arrive as real email in staging; nightly rollups
populate without manual invocation; ROADMAP's "scheduled email" footnote and
parking-lot entry deleted.
