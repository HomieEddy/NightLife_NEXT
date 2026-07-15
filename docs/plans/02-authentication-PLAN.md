# 02 — Authentication & Authorization · PLAN

Goal: real accounts, roles and sessions for staff-side users and platform admins;
the request context every later plan scopes by. Guest QR tokens are **not** here —
they belong to plan 06 with the session domain.

Preconditions: plan 01.

## Reasoning

Auth second, before any feature service, because AD-3's scoped client needs a
session to read `venueId` from, and because retrofitting authorization under
already-live endpoints is the classic security hole factory. The prototype has
five separate auth simulations (demo login, `CURRENT_STAFF_ID`, hardcoded manager
persona, admin password gate, open routes) — each is removed the moment its real
counterpart exists (R7), never both alive at once.

## Design choices

- **Better Auth + organization plugin** per AD-4. Mapping: organization = venue
  (1:1 with `Tenant` for now), member roles = `manager | host | bartender |
  runner`, platform admins = `user.isPlatformAdmin` flag outside any org.
- **StaffMember merges into identity**: `User` (auth) + `Member` (org role) +
  `StaffProfile` (phone, zones, onShift, initials — the venue-domain leftovers).
  `staff-service.listStaff()` joins them back into the exact `StaffMember` shape
  pages expect (R1).
- **Invites** replace direct creation (staff-edit-dialog TODO): manager invite →
  Resend email (AD-8) → accept page sets password. `accountStatus`
  (active/invited/suspended) maps to Better Auth states; suspension bans the
  session.
- **Route protection**: middleware asserts session for `/manager`, `/staff`,
  `/admin` (+ role check per area); handler-level `requireRole()` helpers for
  writes. Demo personas become **seeded real users** (same emails, password =
  documented demo password) so `/demo` and the login chips keep working.
- **Admin gate replaced**: `admin-gate.ts` deleted; `/admin` requires
  `isPlatformAdmin`. Login page keeps the three persona chips (per earlier product
  decision the admin chip stays; it now signs into a real admin account).
- **`getCurrentStaff()`** reads the session (staff/layout TODO) — Nina stops being
  hardcoded; the /staff panel renders whoever signed in.

## Implementation strategy

1. Schema: Better Auth tables (generated) + `StaffProfile` + `Invite`; migrate.
2. `src/server/auth.ts` (Better Auth config), `requireSession/requireRole/
   requirePlatformAdmin` helpers; wire `getDb(session)`.
3. Middleware for the three areas; 401/403 → redirect to `/login`.
4. Replace `mockAuthService` + `auth-context` internals with Better Auth client
   calls (same `AuthUser`/`signIn` signatures — R1).
5. Invite flow: server action + email + accept page; wire staff-edit-dialog's
   create path and "resend invite".
6. Seed live users (Amara/Nina/admin) with roles. Per AD-14: `admin-gate.ts`,
   `CURRENT_STAFF_ID` and the mock personas are **demo-gated, not deleted** —
   the demo build keeps demo auth wholesale (its `authService` selector never
   switches), the live build never imports it.
7. Migrate `staff-service` identity methods (list/update/toggleShift stay; they
   now read User+Member+StaffProfile). Shifts/chat stay mock until plans 03/07.

## Testing

- Unit: role matrix for `requireRole` (every role × every area).
- Integration (the R2/R7 proof): staff token → manager endpoint = 403; venue-A
  manager → venue-B resource = 404/403; suspended user's session invalid; invite
  accept is single-use and expires.
- E2E (Playwright): login as each persona lands on the right home; staff invite
  full loop (invite → email capture → accept → sign in).

## Review checklist

- Any endpoint reachable without a session that mutates state?
- Any remaining read of `CURRENT_STAFF_ID` / mock personas / admin-gate?
- Do session cookies meet baseline flags (httpOnly, sameSite=lax, secure in prod)?
- Is the demo password only on seeded demo users, never a code-path bypass?

## Exit criteria

All five simulations gone; login/logout/invite work in preview; role matrix tests
green; `/demo` tour unaffected (personas still one-tap).

Post-plan note (2026-07-15, plan 09b addendum): the per-area role check on
direct URL entry originally landed only for API writes. It is now enforced at
render time too — manager/staff layouts are server components calling
`requireArea()` in live mode, the proxy guards `/guest/*` on the guest session
cookie, and login redirects each user to their role home (owner/admin →
`/manager`, member → `/staff`, platform admin → `/admin`).
