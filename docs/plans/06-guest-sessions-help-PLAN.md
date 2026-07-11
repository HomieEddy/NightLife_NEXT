# 06 — Guest Sessions, QR Tokens & Help · PLAN

Goal: the guest's server-side identity — signed table tokens, durable sessions
with the approval/closure state machine, help requests. Removes the last guest-side
simulations.

Preconditions: plan 05 (orders attach to sessions).

## Reasoning

Sessions come after orders so they attach to a proven core (roadmap rationale).
This plan owns everything keyed by "who is at this table tonight": the QR entry
(`/g/[tableCode]` TODO), the sessionStorage guest context (guest-context TODO),
approval pushes (guests-service TODO), and closure validation (INV-S2).

## Design choices

- **Signed table tokens** (AD-4 guest half): QR URL becomes
  `/g/<tableId>.<sig>` where `sig = HMAC(tableId + tokenVersion)`. Verification
  is stateless; bumping `VenueTable.tokenVersion` revokes and regenerates —
  fulfils the QR-page "regenerate" TODO with a manager button + confirm dialog.
  Existing pretty slugs keep working as a lookup → token redirect for the demo.
- **Schema**: `GuestSession` (state machine per INV-S1, `tableId` FK + code/zone
  snapshots per DDD §4), `HelpRequest` (FK + snapshots, DDD §4 verdict).
- **Guest cookie**: joining sets a signed httpOnly cookie carrying sessionId;
  `guest-context` keeps its client shape (cart stays client-side — it's a cart,
  not an order) but identity/approval/closure state now round-trips the server.
- **Approval flow**: "Simulate host approval" **deleted** (R7). The waiting page
  polls `getSession` (live push in plan 07). Host approval in /staff/approvals
  writes the real row. `autoApproveGuests` venue setting honored server-side.
- **Closure validation** (INV-S2): `requestClosure` verifies zero in-flight orders
  server-side; `setSessionStatus(closed)` frees the table (approvals TODO:
  "closing settles payment and frees the table" — status flip yes; payment stays
  Phase 3).
- **Session backfill**: plan 05 left `Order.sessionId` nullable; this plan makes
  new orders require an approved session and backfills seeds.

## Implementation strategy

1. Token helper `src/server/table-token.ts` + unit tests (tamper, version bump).
2. Schema + migration + seeds.
3. `/g/[tableCode]` verifies token → creates/loads session (auto-approve path
   honored) → sets cookie.
4. Body swaps: `requestSession`/`getSession` → `setSessionStatus` (staff role
   required) → `requestClosure` → help request methods.
5. QR page: "Regenerate QR" action (tokenVersion bump) + reprint hint.
6. Delete simulations: waiting-page simulate button, closure simulate button,
   guest-context TODOs. Rename to `guestsService`.

## Testing

- Unit: token sign/verify/tamper/revoke matrix.
- Integration: session state machine incl. illegal transitions (INV-S1); closure
  rejected with in-flight orders (INV-S2); revoked token can't join but existing
  session survives (INV-S3); auto-approve setting; help request lifecycle; orders
  rejected on non-approved sessions; tenant isolation.
- E2E: full guest night — scan real QR URL → join → host approves on a second
  context → order → deliver → request closure → host closes → receipt shows the
  session's orders. (Replaces the two deleted simulate buttons in the demo tour
  copy — update `/demo` text in this PR, §9.9.)

## Review checklist

- Is the HMAC secret env-validated and distinct from auth secrets?
- Can a guest cookie from venue A act on venue B (isolation through the guest
  path, not just staff)?
- Does the demo tour's guest walkthrough still read true after simulate-button
  removal?

## Exit criteria

Guest flow runs on real sessions with zero prototype controls; QR regenerate
works; `guestsService` real; AGENTS.md appendix guest-flow gotcha updated.
