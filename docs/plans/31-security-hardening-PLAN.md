# 31 — Security Hardening · PLAN

**Status: not started — ROADMAP Phase 8.**
**Renumbered 2026-07-30:** was plan 22; the old number is retired.

Goal: close the go/no-go checklist's security phase (secrets hygiene, rate
limiting on every abusable endpoint, transport/header security, cookie
flags, input caps, generic errors) so staging can be exposed to the internet
without being a free brute-force target. Much of the checklist is already
architecture here — Prisma parameterizes every query (AD-2), Better Auth
hashes passwords and manages sessions (AD-4), Zod guards every boundary
(AD-7), tenant scoping is central (AD-3) with `expectTenantIsolation()`
canaries — so this plan is a *gap-closing audit with fixes*, not a rebuild.

Preconditions: Phases 1–7 complete (all 29 selectors live, 224 route
handlers under `src/app/api/`). Independent of plans 32–35. Branch
`chore/31-security-hardening`.

## Reasoning

The checklist's blockers map onto this codebase as follows:

| Checklist item | State today | This plan |
|---|---|---|
| No hardcoded secrets | Believed clean; never scanned | gitleaks scan + config committed so plan 36 can gate CI on it |
| SQL injection | **Not Prisma-only.** ~50 `$queryRawUnsafe` call sites across 7 feature modules (`analytics/analytics-depth.ts` ×30, `tab/core.ts`, `ordering/core.ts`, `sessions/core.ts`, `menu/core.ts`, `realtime/events.ts`, `realtime/floor-core.ts`), all on `getRawPrisma()` — which **bypasses the tenant-scoping client extension** (AD-3) | Audit every raw site: (a) confirm values are positional params, never interpolated; (b) confirm each carries an explicit `venue_id` predicate — the extension is not there to add one. This is the plan's highest-value finding, and it is a tenant-isolation risk more than an injection one |
| Auth/authz | Better Auth + `requireArea()` + `requirePermission()` across ~47 handlers (WS-6) | Verify logout invalidation, session expiry config |
| Rate limiting | `features/shared/rate-limit.ts` exists; applied to exactly **two** routes today — `/api/lead` and the reservation PIN route — plus `rate-limit-platform.ts` | Extend to auth, guest join, help, public reservations, and every unauthenticated write |
| HTTPS / headers | Coolify terminates TLS with Let's Encrypt | HSTS + security headers from the app |
| Cookie flags | Better Auth defaults + `nln-guest-session` | Verify HttpOnly/Secure/SameSite explicitly |
| Input limits | Zod schemas exist | Sweep for missing `.max()` string caps |
| Generic errors | Mostly | Sweep 500 paths for stack/detail leakage |

Three repo-specific wrinkles the generic checklist misses:

1. **The embed exception.** Plan 13's `/r/[venueSlug]` is *designed to be
   iframed* by venue websites, and `/e/[venueSlug]` (public events) shares
   the same chrome-less embeddable shell. A blanket `frame-ancestors 'none'`
   / `X-Frame-Options: DENY` would break the product. Headers must be
   route-aware: deny framing everywhere except `/r/*` and `/e/*` (which
   allow any ancestor — venue sites are arbitrary domains).
2. **Single-process reality.** The in-memory token-bucket limiter is correct
   for the AD-15 topology (one VPS process). Redis-backed limiting is a
   scale-out concern, already noted in the limiter's header comment — it
   stays a comment, not work.
3. **There is no shared route-handler error seam.** All 224 handlers build
   their own responses. This plan introduces one — `apiError()` in
   `src/features/shared/` — because the generic-error and rate-limit-429
   work both need a single place to live, and plan 32 hangs the request id
   off the same seam. Adopting it across all handlers is a mechanical sweep;
   do it in its own commit.

Out of scope: RLS defense-in-depth (parked, AD-3), WAF/Cloudflare, 2FA
(post-launch list), penetration testing (post-launch), npm-audit CI wiring
(plan 36 owns CI; this plan fixes what today's audit reports).

## Design choices

- **Rate limits via the existing `checkRateLimit`,** applied in the route
  handlers (matching how lead/platform routes already do it), keyed by IP
  (from the Coolify-forwarded header, validated) plus identifier where it
  exists:
  - Better Auth endpoints (`/api/auth/*` sign-in path): 5/15min per
    IP+email. Better Auth exposes hooks/middleware for this; wire it there
    rather than wrapping the catch-all route blindly.
  - `POST /api/guest/join`: per-IP and per-table burst limits.
  - `POST /api/guest/help`, public reservation create
    (`/api/public/reservations/[venueSlug]` + `/availability`), the public
    events route (`/api/public/events/[venueSlug]`), and the two QR-landing
    routes (`table/[tableId]/active` and `.../pin`): tight per-session/IP
    limits. The PIN route already calls `checkRateLimit`; `active` does not.
    The PIN is 6 digits — without attempt limiting it's brute-forceable in
    minutes. Never add an area guard to these two (see AGENTS.md appendix).
  - `/api/jobs/*` (nightly-rollup, report-schedules, reservation-reminders)
    are `CRON_SECRET`-bearer routes, not session routes — limit them by IP
    as well so a leaked-secret probe is slowed, and keep the 401 generic.
  - 429 responses carry `Retry-After`; limits unit-tested per §7b.
- **Headers in `next.config.ts` `headers()`:** `Strict-Transport-Security`
  (staging first, short max-age, ramp after verification),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy` (camera for the QR
  scanner page only, if used; else deny). Framing: `frame-ancestors 'none'`
  via CSP everywhere except `/r/:path*` and `/e/:path*`. Note
  `next.config.ts` currently has no `headers()` block at all — it carries
  only `distDir`, `reactCompiler` and the demo/live turbopack aliases, so
  this is additive and must not disturb those aliases. CSP for scripts ships
  **report-only** in this plan — Next inline runtime chunks make a strict
  CSP its own project; enforcing it prematurely breaks the app silently.
  Documented as an explicit deferral.
- **Cookie audit, not cookie rewrite:** assert Better Auth session cookie
  and `nln-guest-session` both set HttpOnly + Secure + SameSite=Lax (Lax,
  not Strict — the QR entry flow and embed navigation arrive via top-level
  cross-site navigation; Strict would log guests out on arrival). SameSite
  Lax + Better Auth's CSRF handling covers the CSRF checklist row; no token
  system added.
- **Secrets:** run gitleaks over the full history once; anything found gets
  rotated (not just deleted — history is public the moment the repo is).
  `.env.example` becomes the canonical var list; boot-time config validation
  (already the house pattern) covers every required secret.
- **Error hygiene:** the new `apiError()` seam returns generic messages
  (plan 32 adds the request id to it); Prisma error details and stacks go
  to `features/shared/logger.ts` only. Zod validation errors stay specific —
  field errors are UX, not leakage.
- **Raw-SQL tenant audit:** enumerate every `$queryRawUnsafe` /
  `$executeRawUnsafe` site (`grep -rn "RawUnsafe" src/features`), and for
  each record in the PR body: parameterized? venue-scoped? Sites that read
  tenant data without a `venue_id` predicate are the finding this plan must
  close — `getRawPrisma()` deliberately skips the `getDb()` extension, so
  scoping there is by hand and unverified today.

## Implementation strategy

1. gitleaks full-history scan; rotate anything found; commit config so
   plan 36 can run it in CI.
2. `apiError()` seam + adoption sweep across the 224 handlers (own commit).
3. Rate limiting: auth sign-in, guest join, help, public reservation
   create + availability, public events, PIN attempts, `/api/jobs/*` — with
   tests alongside each (same commit, §7b.3).
4. Headers in `next.config.ts` incl. the `/r/*` + `/e/*` framing exception;
   verify both embeds still frame from a foreign origin (local HTML file
   test).
5. Cookie flag assertions (integration tests reading Set-Cookie) for the
   Better Auth session cookie and `nln-guest-session`; fix any gap in auth
   config.
6. Raw-SQL audit (parameterization + `venue_id` predicate per site) + Zod
   `.max()` sweep + 500-path sweep; fix findings.
7. `npm audit` — fix or document every high/critical with a dated note.
8. Docs: a short `docs/SECURITY.md` recording the posture, the CSP
   deferral, and the rotation procedure.

## Testing

- Unit: limiter configs per endpoint (existing `rate-limit.test.ts`
  pattern); PIN attempt lockout math.
- Integration (PGlite): burst a limited endpoint → 429 + `Retry-After`;
  sign-in attempts lock out; Set-Cookie flags asserted; every raw-SQL read
  of tenant data gets an `expectTenantIsolation()` case (tenant A's venueId
  must not surface tenant B's rows through `getRawPrisma()`); wrong-role and
  cross-tenant canaries still green (no regression from header/middleware
  work).
- Behavioral (§5): compose stack — headers inspected via curl on live and
  demo builds; `/r/[slug]` and `/e/[slug]` iframed from a file:// page render; guest QR
  flow and login still work end-to-end (SameSite regression check);
  `npx next build` both modes.
- Staging: HSTS observed over real TLS; Coolify forwarded-IP header
  confirmed so limits key on the client, not the proxy.

## Review checklist

- No endpoint that writes or authenticates is left unlimited (walk the
  route list in `src/app/api/`, don't sample it).
- Framing denied everywhere except `/r/*` and `/e/*`; both embeds verified,
  not assumed.
- Every `RawUnsafe` site accounted for in the PR body with its scoping
  verdict; none reads tenant data without a `venue_id` predicate.
- Rate-limit keying uses the real client IP behind Coolify, not the proxy.
- No behavior change for legitimate flows: guest join, embed booking, login
  all driven post-change.
- Secrets scan clean; any historical finding rotated with a note.
- CSP enforcement deferral recorded in SECURITY.md with the reason.

## Exit criteria

Every authentication and public-write endpoint provably rate-limited (tests
red-team them), every raw-SQL site audited for parameterization and tenant
scoping, security headers live with both embed exceptions verified,
cookie flags asserted by tests, secrets history scanned clean, npm audit
clean at high+, and `docs/SECURITY.md` records the posture and deferrals —
the checklist's Phase 1/3 rows all check or carry a written, dated deferral.
