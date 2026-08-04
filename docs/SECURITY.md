# Security Posture — NightLifeNext

Last updated: 2026-08-02 (plan 31 audit).

## Overview

NightLifeNext is a multi-tenant SaaS deployed to OVHcloud (Beauharnois, QC)
behind Coolify. TLS is terminated at Coolify (Let's Encrypt). The architecture
is governed by [ARD.md](./ARD.md) (AD-1 through AD-15); security-specific
decisions live in this file.

## Secrets management

- **gitleaks** scans the full git history; config at `.gitleaks.toml`
  (plan 36 wires this into CI).
- `.env.example` is the canonical environment variable reference. Every
  secret has a boot-time validation guard — misspelled or missing vars fail
  configuration, not silently at runtime.
- No hardcoded secrets exist in the repository (gitleaks scan clean, one
  test-fixture false positive allowlisted).
- Rotation procedure: update the value in the Coolify environment dashboard,
  redeploy. The app reads all secrets at startup; a restart is required.

## Authentication & sessions

| Concern | Mechanism |
|---|---|
| Staff/manager/admin login | Better Auth 1.6.23, `emailAndPassword` plugin, bcrypt-hashed passwords, organization-scoped members |
| Guest session | `nln-guest-session` cookie set by `POST /api/guest/join` (12-hour expiry) |
| QR entry | Signed QR token (`QR_TOKEN_SECRET`, distinct from `AUTH_SECRET`) validated at join |
| Reservation PIN | 6-digit PIN checked server-side, rate-limited per table+IP (plan 13) |
| CSRF | SameSite=Lax (Lax, not Strict — QR entry and embed navigation arrive via top-level cross-site navigation; Strict would drop the session on arrival) |

### Session cookie flags

| Cookie | HttpOnly | SameSite | Path | maxAge | Secure |
|---|---|---|---|---|---|
| Better Auth session | yes | Lax | / | session default | prod only |
| `nln-guest-session` | yes | Lax | / | 43,200s (12h) | prod only |

Better Auth config:
- Session cookie cache: 5-minute TTL
- Organization invitation expiry: 48 hours
- Global rate limit: 30 requests/min
- Sign-in rate limit: 5 attempts per 15 minutes per email+IP

Cookie flags are asserted by `src/features/shared/cookies.integration.test.ts`.

## Authorization

- **Area guards:** `requireArea()` / `requireApiArea()` gate `/manager`,
  `/staff`, `/admin` routes by session role (plan 04, AD-4).
- **Permission guard:** `requirePermission(role, action)` checks granular
  staff permissions before executing operations (plan 16).
- **Tenant scoping:** every Prisma operation goes through `getDb({ venueId })`
  which injects a `venueId` predicate via a Prisma client extension (AD-3).
  Tenant isolation is verified by `expectTenantIsolation()` canary helpers in
  integration suites.
- **Platform models:** a curated `platformModels` list in `db.ts` exempts
  cross-tenant models (organization, plan configs) from auto-scoping.
- **Raw SQL** (~50 `$queryRawUnsafe` sites across 7 feature modules) runs on
  `getRawPrisma()` which bypasses the tenant-scoping extension. Every site was
  audited (plan 31): all use positional parameters (`$1`, `$2`), never string
  interpolation; all tenant-data reads carry an explicit `venue_id` predicate.
  New raw SQL must follow the same rules.

## Rate limiting

Token-bucket limiter in `src/features/shared/rate-limit.ts`, keyed by client
IP (from `x-forwarded-for` or `x-real-ip` headers set by Coolify).

| Endpoint | Key | Limit | Window |
|---|---|---|---|
| Better Auth sign-in | email + IP | 5 | 15 min |
| Better Auth global | IP | 30 | 60 s |
| `POST /api/guest/join` | IP | 10 | 60 s |
| `POST /api/guest/join` | table | 20 | 5 min |
| `POST /api/guest/help` | session | 3 | 60 s |
| `POST /api/guest/help` | IP | 10 | 60 s |
| `POST /api/public/reservations/[venueSlug]` | IP + venue | 10 | 5 min |
| `GET /api/public/reservations/[venueSlug]/availability` | IP | 30 | 60 s |
| `GET /api/public/events/[venueSlug]` | IP + venue | 30 | 60 s |
| `GET /api/public/reservations/table/[tableId]/active` | table + IP | 10 | 60 s |
| `POST /api/public/reservations/table/[tableId]/pin` | table + IP | 5 | 5 min |
| `/api/jobs/*` (nightly-rollup, report-schedules, reservation-reminders) | IP | 5 | 60 s |
| Platform plan-configs PATCH | session | configurable | configurable |

429 responses carry `Retry-After` in seconds. All limiter configs are unit-tested
(plan 7b; `src/features/shared/rate-limit.test.ts` and
`src/features/shared/rate-limit.integration.test.ts`).

**Design note:** the limiter is in-memory — correct for the single-VPS
deployment topology (AD-15). Redis-backed limiting is the scale-out path,
noted in the limiter's header comment.

## Security headers

Configured in `next.config.ts` `headers()` function. All routes except
embeddable shells get:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | `frame-ancestors 'none'` |
| `Content-Security-Policy-Report-Only` | script/style/font/img/connect reporting to `/api/csp-report` |
| `Strict-Transport-Security` | `max-age=86400; includeSubDomains` (production only, short ramp) |

### Framing exception

`/r/[venueSlug]` and `/e/[venueSlug]` are embeddable shells (plan 13) — venue
websites iframe them for reservations and events. These routes use
`frame-ancestors *` instead of `'none'`.

### CSP script enforcement — deferred

The CSP script policy is **report-only** (`Content-Security-Policy-Report-Only`).
Next.js emits inline runtime chunks that make a strict CSP impractical without
`'unsafe-inline'` or nonce/hash infrastructure. Enforcing script CSP is its own
project; violations are reported to `/api/csp-report` so the gap can be
measured. This deferral is recorded 2026-08-02 (plan 31).

## Input validation

All route handler inputs are parsed by Zod schemas with `.safeParse()`. Plan 31
added `.max()` string caps to publicly exposed schemas:

- `zPublicReservationInput`: venueSlug:50, tableId:30, zoneId:30, guestName:100,
  partySize:100, guestEmail:254, guestPhone:20, note:1000, eventId:30
- `zCreateSession`: tableId:30, tableCode:20, zoneName:50, displayName:100,
  partySize:100
- `zCreateHelpRequest`: sessionId:30, tableCode:20, zoneName:50, guestName:100

Validation errors return field-level detail (Zod messages are UX, not leakage).
Internal errors return generic `"Operation failed"` — the real error is logged
via `src/features/shared/logger.ts` and never reaches the client.

## SQL injection prevention

- All Prisma-generated queries are parameterized (Prisma's query engine design,
  AD-2).
- ~50 raw SQL sites use `$queryRawUnsafe` / `$executeRawUnsafe` with positional
  parameters (`$1`, `$2`, ...) — never string interpolation.
- All raw SQL reads of tenant data include an explicit `venue_id` predicate
  (audited plan 31, all sites verified safe).
- The `getRawPrisma()` escape hatch is documented as bypassing the tenant-scoping
  extension in `src/features/shared/db.ts`.

## npm audit status (2026-08-02)

**Next.js bumped from 16.2.10 to 16.2.12** (patch: fixes 9 CVEs including
middleware bypass, SSRF in rewrites, DoS in image optimization, and
unauthenticated Server Function endpoint disclosure).

4 vulnerabilities remain — all in next-internal transitive dependencies:

| Package | Severity | Reason not fixed |
|---|---|---|
| next-bundled `postcss` (8.4.31) | high | Only updated when Next.js bumps its bundled copy. Our CSS is Tailwind-generated at build time; no user-uploaded CSS processed. Attack vectors require attacker-controlled CSS with malicious `sourceMappingURL` comments — not applicable. |
| `sharp` (<0.35.0) | high | libvips CVEs. Only updated when Next.js bumps its bundled copy. We do not process user-uploaded images through `next/image` optimization. |
| `better-auth` → vulnerable next | moderate | Audit-chain flag: better-auth depends on next as a peer. Not a vuln in better-auth itself. |

`npm audit fix --force` would downgrade to next@9.3.3 — not acceptable.

## Error hygiene

- The `apiError()` seam in `src/features/shared/api-error.ts` provides
  consistent error responses: 4xx passes the message through, 5xx returns
  a generic `"Internal server error"` and logs the real error.
- Every route handler catch block logs the real error via
  `src/features/shared/logger.ts` and returns a generic message
  (audited plan 31, zero `(e as Error).message` leaks remain).
- Zod validation errors remain specific — they are field-level UX.

## Data residency

All production data resides in OVHcloud Beauharnois, QC, Canada. This satisfies
PIPEDA and Quebec Law 25 data-residency requirements (see plans 34–35).

## Reporting

Security issues: report to the project maintainer. Do not open public issues
for vulnerabilities.

## Future work

| Item | Plan | Status |
|---|---|---|
| CSP script enforcement | 31 | Deferred — report-only mode active, violations collected via `/api/csp-report` |
| CI gate on gitleaks | 36 | Config committed (.gitleaks.toml), CI wiring TBD |
| npm audit CI gate | 36 | TBD |
| Redis-backed rate limiting | 31 | Noted — required for horizontal scaling |
| RLS defense-in-depth | AD-3 | Parked — Prisma client extension is the current layer |
| 2FA | post-launch | Not started |
| Penetration testing | post-launch | Not started |
| WAF / Cloudflare | post-launch | Not started |
