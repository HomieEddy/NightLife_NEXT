# 03 — Venue, Zones & Tables · PLAN

Goal: first real feature service — pure CRUD, no money math, the safest place to
prove the migration pattern end-to-end (schema → handlers → service body swap →
tests) before the risky plans copy it.

Preconditions: plans 01, 02.

## Reasoning

AGENTS.md §9.4 starts here deliberately: every entity is simple, the service
surface is already clean (`venue-service.ts`), and success produces a **template
PR** the next seven plans imitate. Also unblocks everything downstream — menu
items hang off the venue, orders hang off tables.

## Design choices

- **Schema**: `Venue` (1:1 with Tenant; fees/SLA/floorMap as JSONB columns typed
  by Zod — they're config blobs, not query targets), `Zone`, `VenueTable`
  (status enum, mapX/mapY, `tokenVersion Int` reserved for plan 06). Per DDD §4:
  `Zone.tableCount` **dropped** — derived by count.
- **Shifts move here too**: `StaffShift` table (types.ts TODO — "becomes a shifts
  table"); it's venue config-shaped and completes `staff-service`.
- **API shape**: route handlers `GET/POST /api/venue`, `/api/zones[/id]`,
  `/api/tables[/id]` + narrow actions (`setTableStatus`, `setTablePosition`) as
  server actions — matching the existing method granularity 1:1 so bodies swap
  clean (R1).
- **Floor-map default layout** (`ensureMapPositions`) runs at seed/create time
  server-side — same algorithm, moved verbatim.
- **Deletion guards** stay server-enforced: zone-with-tables rejected (INV-V1).

## Implementation strategy

1. Prisma models + migration; extend `prisma/seed.ts` with mock zones/tables.
2. Handlers/actions with Zod schemas; scoped db throughout.
3. Swap `mockVenueService` method bodies one commit each: venue get/update →
   zones CRUD → tables CRUD/status/position. `getVenueSnapshot()` (sync, used by
   cart fee math) becomes an async-cached read — the two call sites are updated in
   the same commit (the one sanctioned signature change; noted for review).
4. Move shift methods from `staff-service` mock arrays to the `StaffShift` table.
5. Rename `mockVenueService` → `venueService` (last method real); delete consumed
   TODOs (`venue-service`, `settings` PATCH, types.ts shifts).
6. Onboarding wizard + admin provisioning keep working: wizard writes via the real
   service now; verify the prefill round-trip.

## Testing

- Unit: none needed beyond Zod schema edge cases (no math here — don't pad).
- Integration: CRUD per entity incl. INV-V1 rejection; `expectTenantIsolation` on
  all three models; status/position actions persist; shifts CRUD.
- E2E: manager onboarding wizard completes against real DB and the dashboard
  reflects the edited venue name (the flow that burned us in Phase 1).

## Review checklist

- Template quality: is this PR the shape we want seven more of?
- Any page importing mock-data venue literals directly (grep `mock-data/venue`)?
  (`cart-contents`, `receipt`, guest layout do — they read `mockVenue.name` etc.;
  route them through the service in this PR.)
- JSONB config columns validated by Zod on write, not trusted on read?

## Exit criteria

`venueService` fully real; settings/zones/tables/floor-map/QR pages and the
onboarding wizard all drive against Postgres in preview; reload no longer resets
venue config (update the AGENTS.md appendix gotcha in this PR — §9.9).
