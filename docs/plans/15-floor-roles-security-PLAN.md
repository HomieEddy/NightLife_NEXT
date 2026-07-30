# 15 — Floor-Role Capability Matrix, Security Panel & Demo Personas · PLAN

**Status: demo track complete; live graduation pending (ROADMAP Phase 7, WS-6).**
The capability matrix and security panel run on the mock permission service; the
live branch still reads the hardcoded default map and needs
`venue_role_permissions` persistence.

Goal: the `/staff` panel stops pretending every floor role is a runner. Three
moves: (1) redefine the **runner** as the bartender/hostess assistant —
fulfillment hands, not an approver; (2) give **security** a real mobile view —
security help requests, their schedule, chat; (3) restructure the demo so each
role is showcased with its own sign-in persona (and the Platform Admin button
leaves the demo login — `/admin` stays reachable by URL).

Preconditions: plan 07 (help/chat/floor coordination), plan 09b (live staff
identity). Plan 14 introduces `src/lib/role-capabilities.ts` and the
role-driven `StaffShell` nav; this plan extends that map — if 15 lands first,
it ships the seam and 14 extends it (the seam is shared, whoever's first
builds it).

## Reasoning

The staff panel was built when the demo had one persona (a runner) and every
button rendered for everyone. Real floors divide labor: hosts approve tables,
bartenders and runners move product, security keeps people safe. The fix is
not per-page `if (role)` sprinkles — it's one **capability matrix** consumed
by nav, pages *and* (at graduation) route handlers, so the UI and the
authorization boundary can never disagree.

Interpretation choices (stated per §1.4):

- **Seven base roles, five sub-role specializations.** The base roles
  (manager, host, bartender, runner, security, promoter, platform-admin) drive
  authN/authZ. Five sub-role specializations (Floor Manager, VIP Host, Bar Lead,
  Security Lead, Door Host — named in PRD §2) are permission sets defined in the
  capability matrix, not separate auth roles. Floor Manager shares the `manager`
  base role with venue-configurable comp threshold delegation. VIP Host shares
  the `host` base role with VIP-tier guest-profile write access and
  promoter-like booking capabilities. Bar Lead shares the `bartender` base role
  with inventory cost visibility and purchasing draft capabilities. Security
  Lead shares the `security` base role with incident-read-all, incident-mark-
  reportable, and emergency-evacuate capabilities. Door Host shares the
  `security` base role with door:admit and door:id-check scope, without
  incident-read-all access. The capability matrix includes all five
  sub-specializations as columns.

- "Runner = bartender and hostess assistant" ⇒ runners **fulfill**: they can
  transition claimed orders through preparing → ready → delivered, but they
  do **not accept** pending orders (accepting is the approval that commits
  the bar — bartender/host/manager territory) and they see the Approvals
  queue read-only at most (session approval is host work).
- "Help requests assigned to their tables" ⇒ runners see and resolve help
  requests whose table sits in their `assignedZoneIds` — except
  `security`-type requests, which route to security regardless of zone.
- Security's panel is deliberately minimal per the ask: security help queue,
  their shifts, chat (they already own a chat channel). No orders, no
  approvals — a bouncer's phone shows trouble, their hours and the radio.
- Hosts and bartenders keep today's full floor surface; the matrix just
  names what was implicit.

## Design choices

- **Capability matrix** (`src/lib/role-capabilities.ts`, shared with plan
  14): per `StaffRole` — nav items, order actions
  (`accept`, `prepare`, `ready`, `deliver`, `claim`), session approval,
  help-request scope (`all` | `assigned-zones` | `security-only`), schedule
  visibility, chat channels. One table, read by `StaffShell`, page action
  guards, and later the route handlers. Adding a role = adding a row.
  - manager: everything (unchanged).
  - host: accept/claim/deliver orders, session approvals, all help, chat.
  - bartender: accept/prepare/ready orders, no session approvals, bar +
    assigned-zone help, chat.
  - **runner: claim, prepare/ready/deliver — no accept, no session
    approvals; help limited to assigned zones (minus security type)**.
  - security: no orders/approvals; security help requests only; schedule;
    chat (`security` channel).
  - promoter: plan 14's row (read-only, own-funnel scoping).
  - **floor-manager** (sub-specialization of manager): same as manager with
    venue-configurable comp threshold and schedule-publish capabilities;
    elevated dashboard and analytics access equivalent to manager.
  - **vip-host** (sub-specialization of host): same as host with added
    guest:edit-profile, guest:watchlist write, and VIP-tier recognition
    capabilities; reservation book management scoped to VIP table tiers.
  - **bar-lead** (sub-specialization of bartender): same as bartender with
    added cost:read, purchasing:draft, inventory:86, stocktake:count
    capabilities; bar-zone oversight scope.
  - **security-lead** (sub-specialization of security): same as security
    with added incident:read-all, incident:mark-reportable,
    emergency:evacuate, and door:admit-capacity-override capabilities.
  - **door-host** (sub-specialization of security): door:count, door:admit,
    door:id-check, waitlist:manage only — no incident:read-all,
    incident:create limited to refused-entry type only.
- **Runner UX**: pending orders render without an Accept button (with a
  quiet "awaiting bartender" hint, not a disabled tease); Approvals tab
  drops from the runner nav; help queue filters to assigned zones.
  Action gating comes from the matrix — no per-page role conditionals.
- **`ASSIGNABLE_ROLES`**: `"security"` stops being legacy — the manager can
  hire security (and promoters, per plan 14) from the staff page. The
  "security is legacy" comment in `types.ts` dies here.
- **Security panel**: nav **Home · Help · Schedule · Chat**.
  - Home: open security requests count, tonight's shift, latest security
    broadcasts.
  - Help: the existing help page scoped by the matrix to `security`-type
    requests (acknowledge/resolve as today).
  - **Schedule** (`/staff/schedule`, new — and shown to *all* floor roles;
    "my shifts" was always missing): the signed-in member's upcoming shifts,
    read-only, reusing the manager schedule-tab's data shapes.
  - Chat: existing page; matrix pins security to the `security` channel.
- **Demo personas** (`mock-data/auth.ts` + login page): one sign-in card per
  floor role — Manager, Host, Bartender, Runner, Security, Promoter — each
  mapping to a seeded staff member whose data makes the role's view
  non-empty (runner with claimed orders in flight, security with open
  security requests, promoter with a live funnel). **The Platform Admin card
  is removed** from the demo login; `/admin` remains reachable directly by
  URL (its existing demo gate is untouched). The login card list groups
  "venue ops" roles so six buttons don't read as clutter. `AuthUser.role`
  ("manager" | "staff" | "admin") stays the coarse routing role — floor
  personas all route to `/staff`; the persona's staff id drives
  `getCurrentStaff` (demo's `CURRENT_STAFF_ID` becomes "the signed-in
  persona's id", kept per-session in the auth context, still resetting like
  all demo state).
- **Mock data restructure**: seed shifts for every active staff member
  (security included — Viktor finally gets hours), a second security member,
  security-type help requests open at seed time, and zone assignments that
  make runner filtering visible in the preview (one zone with requests the
  runner sees, one they don't).
- **Live graduation**: the matrix is enforced in route handlers/floor-core —
  order-transition endpoints check the action against the caller's profile
  role; help/approval endpoints check scope. Wrong-role 403 tests per §7b.6.
  UI and server read the same map, so drift is impossible by construction.

## Implementation strategy

Demo track:

1. `role-capabilities.ts` matrix (+ plan-14 seam if 14 hasn't landed);
   `ASSIGNABLE_ROLES` update; types comment cleanup.
2. Mock data: personas, staff, shifts, security help requests, zone
   assignments.
3. `StaffShell` role-driven nav; runner action gating on orders/approvals/
   help; `/staff/schedule`; security Home variant.
4. Login page: role persona cards, admin card removed, persona → staff-id
   wiring in the demo auth context.

Live track (graduation):

5. Server-side matrix enforcement in order/help/session handlers; wrong-role
   integration tests; matrix-driven checks replace any ad-hoc role
   comparisons found in the sweep (grep for `role ===` across `src/server/`).

## Testing

- Unit: capability lookups (runner lacks `accept`, security help scope is
  `security-only`, help zone filtering including the security-type carve-out)
  — the matrix is a pure map, test it as one.
- Integration (live): runner token on accept endpoint → 403, on
  prepare/ready/deliver of a claimed order → 200; runner on session approval
  → 403; security on order endpoints → 403; help listing scoped per role;
  tenant-isolation canaries on new/changed routes.
- E2E (demo): sign in as runner → pending order shows no Accept → bartender
  persona accepts (fresh context) → runner prepares/readies/delivers; sign in
  as security → sees security request, acknowledges, checks schedule, posts
  in security chat. Login page shows six venue cards and no Platform Admin.
- Preview drive in both build modes.

## Review checklist

- Is every action gate read from the matrix (grep for stray `role ===` in
  pages after the change)?
- Does hiding runner Accept degrade gracefully — can a runner-claimed order
  still be accepted by someone else without a claim fight (INV-O3 respected)?
- Security-type help requests invisible to runners even in their zones, and
  visible to security regardless of zone?
- Do all six demo personas land on a non-empty, role-correct panel on first
  paint (seed data proves each role)?
- Admin unreachable from the demo login UI but `/admin` URL behavior
  unchanged; `next build` green in both modes.

## Exit criteria

Six demo sign-ins each tell their role's story: the runner fulfills but never
accepts or approves and sees only their zones' help; security lives in a
help/schedule/chat panel; every floor member can see their own shifts. The
Platform Admin button is gone from the demo login. At graduation the same
capability matrix that draws the nav rejects the wrong role at the API, with
tests proving each denial.
