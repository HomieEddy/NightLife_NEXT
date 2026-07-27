# 22 — Security Hardening · PLAN

**Status: not started.**

Goal: close the go/no-go checklist's security phase (secrets hygiene, rate
limiting on every abusable endpoint, transport/header security, cookie
flags, input caps, generic errors) so staging can be exposed to the internet
without being a free brute-force target. Much of the checklist is already
architecture here — Prisma parameterizes every query (AD-2), Better Auth
hashes passwords and manages sessions (AD-4), Zod guards every boundary
(AD-7), tenant scoping is central (AD-3) with `expectTenantIsolation()`
canaries — so this plan is a *gap-closing audit with fixes*, not a rebuild.

Preconditions: plans 01–10 complete. Independent of plans 25–29. Branch
`chore/15-security-hardening`.

## Reasoning

The checklist's blockers map onto this codebase as follows:

| Checklist item | State today | This plan |
|---|---|---|
| No hardcoded secrets | Believed clean; never scanned | gitleaks scan + CI gate (plan 14 runs it) |
| SQL injection | Prisma-only queries | Audit for `$queryRaw` usage; test any found |
| Auth/authz | Better Auth + `requireArea()` + scoped client | Verify logout invalidation, session expiry config |
| Rate limiting | `rate-limit.ts` exists; applied only to lead + platform routes | Extend to auth, guest join, help, public reservations |
| HTTPS / headers | Coolify terminates TLS with Let's Encrypt | HSTS + security headers from the app |
| Cookie flags | Better Auth defaults + `nln-guest-session` | Verify HttpOnly/Secure/SameSite explicitly |
| Input limits | Zod schemas exist | Sweep for missing `.max()` string caps |
| Generic errors | Mostly | Sweep 500 paths for stack/detail leakage |

Two repo-specific wrinkles the generic checklist misses:

1. **The embed exception.** Plan 13's `/r/[venueSlug]` is *designed to be
   iframed* by venue websites. A blanket `frame-ancestors 'none'` /
   `X-Frame-Options: DENY` would break the product. Headers must be
   route-aware: deny framing everywhere except `/r/*` (which allows any
   ancestor — venue sites are arbitrary domains).
2. **Single-process reality.** The in-memory token-bucket limiter is correct
   for the AD-15 topology (one VPS process). Redis-backed limiting is a
   scale-out concern, already noted in the limiter's header comment — it
   stays a comment, not work.

Out of scope: RLS defense-in-depth (parked, AD-3), WAF/Cloudflare, 2FA
(post-launch list), penetration testing (post-launch), npm-audit CI wiring
(plan 14 owns CI; this plan fixes what today's audit reports).

## Design choices

- **Rate limits via the existing `checkRateLimit`,** applied in the route
  handlers (matching how lead/platform routes already do it), keyed by IP
  (from the Coolify-forwarded header, validated) plus identifier where it
  exists:
  - Better Auth endpoints (`/api/auth/*` sign-in path): 5/15min per
    IP+email. Better Auth exposes hooks/middleware for this; wire it there
    rather than wrapping the catch-all route blindly.
  - `POST /api/guest/join`: per-IP and per-table burst limits.
  - `POST /api/guest/help`, public reservation create, PIN attempts
    (plan 13 gate): tight per-session/IP limits — the PIN is 6 digits;
    without attempt limiting it's brute-forceable in minutes.
  - 429 responses carry `Retry-After`; limits unit-tested per §7b.
- **Headers in `next.config.ts` `headers()`:** `Strict-Transport-Security`
  (staging first, short max-age, ramp after verification),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy` (camera for the QR
  scanner page only, if used; else deny). Framing: `frame-ancestors 'none'`
  via CSP everywhere except `/r/:path*`. CSP for scripts ships
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
- **Error hygiene:** the shared route-handler error path returns generic
  messages + request id (plan 23 adds the id); Prisma error details and
  stacks go to logs only. Zod validation errors stay specific — field
  errors are UX, not leakage.

## Implementation strategy

1. gitleaks full-history scan; rotate anything found; commit config so
   plan 14 can run it in CI.
2. Rate limiting: auth sign-in, guest join, help, public reservation
   create, PIN attempts — with tests alongside each (same commit, §7b.3).
3. Headers in `next.config.ts` incl. the `/r/*` framing exception; verify
   the embed still frames from a foreign origin (local HTML file test).
4. Cookie flag assertions (integration tests reading Set-Cookie); fix any
   gap in auth config.
5. `$queryRaw` sweep + Zod `.max()` sweep + 500-path sweep; fix findings.
6. `npm audit` — fix or document every high/critical with a dated note.
7. Docs: a short `docs/SECURITY.md` recording the posture, the CSP
   deferral, and the rotation procedure.

## Testing

- Unit: limiter configs per endpoint (existing `rate-limit.test.ts`
  pattern); PIN attempt lockout math.
- Integration (PGlite): burst a limited endpoint → 429 + `Retry-After`;
  sign-in attempts lock out; Set-Cookie flags asserted; a `$queryRaw` (if
  any survives the sweep) gets an injection-attempt test; wrong-role and
  cross-tenant canaries still green (no regression from header/middleware
  work).
- Behavioral (§5): compose stack — headers inspected via curl on live and
  demo builds; `/r/[slug]` iframed from a file:// page renders; guest QR
  flow and login still work end-to-end (SameSite regression check);
  `npx next build` both modes.
- Staging: HSTS observed over real TLS; Coolify forwarded-IP header
  confirmed so limits key on the client, not the proxy.

## Review checklist

- No endpoint that writes or authenticates is left unlimited (walk the
  route list in `src/app/api/`, don't sample it).
- Framing denied everywhere except `/r/*`; embed verified, not assumed.
- Rate-limit keying uses the real client IP behind Coolify, not the proxy.
- No behavior change for legitimate flows: guest join, embed booking, login
  all driven post-change.
- Secrets scan clean; any historical finding rotated with a note.
- CSP enforcement deferral recorded in SECURITY.md with the reason.

## Exit criteria

Every authentication and public-write endpoint provably rate-limited (tests
red-team them), security headers live with the embed exception verified,
cookie flags asserted by tests, secrets history scanned clean, npm audit
clean at high+, and `docs/SECURITY.md` records the posture and deferrals —
the checklist's Phase 1/3 rows all check or carry a written, dated deferral.
