# 32 — Observability: Logging, Errors, Health & Uptime · PLAN

**Status: not started — ROADMAP Phase 8.**
**Renumbered 2026-07-30:** was plan 23; the old number is retired.

Goal: when staging (then production) misbehaves at 1 a.m. on a Saturday —
the app's peak hour by definition — someone finds out from an alert, not
from a venue's angry text, and can see what happened from structured logs
and error traces. Ships: JSON logging with request ids, error tracking,
a health endpoint, uptime monitoring with alerting, and log rotation.

Preconditions: none hard; pairs naturally **after plan 31** — plan 31
introduces the `apiError()` route-handler seam (there is none today; all
224 handlers build their own responses) and this plan hangs the request id
off it. Before go-live. Branch `chore/32-observability`.

## Reasoning

The checklist's Phase 5 lists a full Prometheus/Grafana metrics stack. For
a one-process app on one VPS serving its first venues, that's
over-instrumentation — the failure modes that matter are: the app is down,
the app is erroring, a request is slow, the DB is the reason. Those four
are covered by health checks + uptime pings, error tracking, request-id'd
JSON logs with durations, and plan 33's slow-query logging. A metrics
timeseries stack is deferred with a named trigger: when tuning alert
thresholds or capacity needs *trends* rather than *incidents*, deploy
Grafana + Loki/Prometheus via Coolify then. This is the same YAGNI ladder
the repo applies to dependencies (§2.4).

Tool choices favor boring and self-hostable per AD-15's cost logic:

- **pino** for logging — the standard, fast, structured, redaction built in.
- **Sentry** for errors — free tier is ample at this scale; deployment- and
  release-aware grouping is exactly the checklist's ask. **Residency caveat:
  decide this before wiring, not after.** AD-15 puts data in Quebec for
  Law 25/PIPEDA, and error payloads carry request context (user ids, venue
  ids, sometimes guest fields). Either (a) self-host GlitchTip via Coolify
  on the same VPS — API-compatible SDK, keeps everything in Canada, and is
  the default recommendation here, or (b) use hosted Sentry with
  `sendDefaultPii: false`, aggressive `beforeSend` scrubbing, and a
  transfer assessment recorded in plan 35's data inventory. Whichever is
  chosen, record it in `docs/SECURITY.md` and the inventory.
- **Uptime Kuma** self-hosted via Coolify one-click — external-ish ping
  (separate container, same host; a truly external free pinger like
  UptimeRobot on top costs nothing and covers the host-down case — use
  both).

## Design choices

- **Logger: upgrade the existing module in place.**
  `src/features/shared/logger.ts` already exports a hand-rolled
  `{info,warn,error}` JSON-to-console wrapper (marked `ponytail: swap for
  structured transport if needed` — this is that moment). Swap its internals
  for a configured pino instance and **keep the import path and the call
  signature** so existing call sites don't churn; don't add a parallel
  `src/server/log.ts`. JSON always, level from `LOG_LEVEL` (info default in
  staging/prod), redaction paths for the known PII/secret fields (email,
  phone, authorization headers, cookies, PIN, tokens). Server-only from here
  on — today's nine importers (the three `/api/jobs/*` routes, the
  reservation-status route, the email/sms/push dispatchers, and the two
  queue modules) are all server-side, so the swap is safe; re-check with
  `grep -rln "shared/logger" src/` before doing it.
- **Request ids + access logs:** a small wrapper around route handlers —
  extend plan 31's `apiError()`/handler seam, don't parallel it —
  generates/propagates `x-request-id`, logs one line per
  request: id, userId (when authed), venueId, method, path, status,
  duration_ms. The id returns in responses and error payloads so a
  support screenshot maps to logs. SSE routes log open/close, not
  keepalives.
- **Sentry:** server + client init, `SENTRY_DSN` optional (absent = no-op —
  local dev and demo build ship no DSN), release tagged from the git SHA at
  build (Coolify provides it), environment tag staging/production. Alert
  rules configured in-product: new issue, and error-rate spike; routed to
  email now, plan 25/26 channels later if wanted.
- **Health:** `GET /api/health` (`src/app/api/health/route.ts` — no such
  route exists today) — 200 with `{status, uptime, checks: {db}}`;
  the DB check is a `SELECT 1` with a short timeout; DB-down returns 503.
  Add a `checks.queue` line only if BullMQ/Redis is configured
  (`REDIS_URL` is optional — the cron fallback is a valid topology, so an
  absent queue is healthy, not degraded).
  Unauthenticated but rate-limited (plan 31's limiter) and deliberately
  free of version/config detail. The demo build's health is static-ok (no
  DB to check; resource guard).
- **Uptime:** Kuma monitors `/api/health` on staging + prod and the demo's
  Vercel URL; UptimeRobot externally pings the same three. Alerts to email
  immediately; escalation contacts live in RUNBOOK.md.
- **Log destination & rotation:** pino → stdout → Docker json-file driver
  with `max-size`/`max-file` set in the Coolify service config (rotation
  solved at the container layer, no logrotate on the app). Search =
  `docker logs` + grep by request id, adequate at one process; Loki is the
  named upgrade when multi-service search hurts.
- **Job observability:** the `JobRun` model already records cron executions
  for the three `/api/jobs/*` handlers. Log one structured line per run
  (job name, duration, rows touched, outcome) and add a Kuma
  "last successful run is stale" check per job — a silently dead
  reservation-reminder job is invisible to a health endpoint.
- **Audit trail:** plan 10 already ships the platform `AuditEntry` log;
  plan 25's `NotificationLog` covers sends. This plan adds auth-event logging (login
  success/failure, logout, invite accept) via the pino logger — queryable
  by the request-id pipeline, satisfying the checklist's auth-events row
  without a new table.

## Implementation strategy

1. pino inside `features/shared/logger.ts` + redaction config + unit tests
   (redaction actually redacts); existing call sites unchanged.
2. Handler wrapper: request id, access line, error path integration (plan
   31's `apiError()` + id); SSE open/close lines on `/api/live/*`.
3. Auth event log lines in the Better Auth hook seam; `JobRun` log lines.
4. Sentry init (server/client), release/env tags, no-DSN no-op verified;
   one deliberate test error captured on staging.
5. `/api/health` + tests (200, DB-down 503 via PGlite teardown trick,
   rate-limited).
6. Coolify: log rotation opts; Kuma deployed + monitors + email alerts;
   UptimeRobot externally.
7. **Create `docs/RUNBOOK.md`** — it does not exist yet; the only runbook
   today is `docs/RUNBOOK-VPS-SETUP.md` (provisioning, not operations).
   This is the operations runbook plans 33 and 35 also append to
   (§restore, §privacy-requests, §incident-response). Ships with "app is
   down/erroring/slow" triage flows keyed to these tools, plus escalation
   contacts. Link it from HOSTING.md.

## Testing

- Unit: redaction paths (feed a fake log call PII, assert scrubbed);
  request-id propagation.
- Integration (PGlite): health 200 shape; 503 when the DB handle is
  closed; request id present on error responses; auth events logged on
  login/fail.
- Behavioral (§5): compose stack — drive an order flow, then locate its
  full request trail in logs by id alone (the actual on-call motion);
  throw the test error, see it in Sentry with release + request id; stop
  the db container, watch health flip 503 and Kuma alert fire (staging).
- Demo build: builds and runs with zero logging/Sentry/DB imports active
  (bundle check + resource guard).

## Review checklist

- No PII or secret in any log line — grep the captured test-run output,
  not just the redaction config.
- Request id flows: response header ↔ error payload ↔ every log line of
  the request.
- Health endpoint leaks no version/dependency detail; is rate-limited.
- Sentry absent = true no-op (demo bundle unaffected, local dev quiet).
- Rotation configured — a week of staging logs stays bounded (checked
  after a week, noted in the PR or a follow-up commit).
- RUNBOOK triage flows written from actually performing them once.

## Exit criteria

A staged failure (killed DB) alerts within minutes via Kuma; a thrown test
error appears in Sentry tagged with release and request id; any request's
full log trail is retrievable by the id shown to the user on error; logs
are JSON, redacted, and rotation-bounded; and RUNBOOK.md turns those tools
into a 1 a.m. triage script — checklist Phase 5's monitoring rows check,
with the metrics-stack deferral written down and triggered.
