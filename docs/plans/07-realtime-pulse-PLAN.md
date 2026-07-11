# 07 — Realtime & Floor Pulse · PLAN

Goal: replace every poll with live push (R6) and make the floor-coordination
state real — broadcasts, last call, show lock, chat. The plan that makes two
phones feel like one floor.

Preconditions: plans 05, 06 (their domain events are the payload).

## Reasoning

Six separate `setInterval` polls (manager dashboard/orders, staff home/orders,
guest orders/waiting) all simulate one missing capability. Doing realtime as one
plan — after the events exist — collapses them into a single mechanism instead of
six bespoke ones. Floor-coordination state (pulse-service, show-queue-service)
migrates here because its whole value *is* the push.

## Design choices

- **SSE + Postgres NOTIFY** per AD-6. `src/server/events.ts`: `publish(event)` =
  INSERT into `domain_events` (audit) + `pg_notify(venue channel)`. Three stream
  endpoints: `/api/live/staff`, `/api/live/manager`, `/api/live/guest`
  (session-scoped) — each filters the event vocabulary from DDD §3 to its
  audience (guests must not receive other tables' events).
- **Client hook `useLiveEvents(scope, onEvent)`**: EventSource with
  reconnect+backoff; on sustained failure, falls back to the page's existing
  `refresh()` on the old interval — the polls become the fallback, not dead code.
  Pages keep their `refresh` functions; the hook just calls them on relevant
  events (small, mechanical page diffs; R1 untouched).
- **Schema**: `Broadcast` (ledger), `VenueFloorState` (singleton row per venue:
  lastCallActive/startedAt), `ActiveShow` (nullable singleton per venue),
  `ChatMessage` (ledger), `domain_events`.
- **Show lock** (INV-F1): `startShow` = transaction with `SELECT … FOR UPDATE` on
  the venue's ActiveShow row (show-queue TODO); loser gets the current holder in
  the error, exactly like the mock's UX.
- **Last call**: flag moves to `VenueFloorState`; plan 05's server-side rejection
  now reads the real flag; start/end emit events consumed by staff banner, guest
  banner, and Pulse table-closeout items.
- **Chat**: messages persist; sends publish; channels unchanged. The
  manager-author override from pulse broadcasts is replaced by the real session
  author (managers are users now).
- **Pulse feed stays derived**: `computeAttentionItems` unchanged; the dashboard
  recomputes on events instead of an 8s timer.

## Implementation strategy

1. `domain_events` + publish helper; retrofit plans 04–06 write paths that
   deferred emission (grep for the plan-05 review item).
2. Stream endpoints + `useLiveEvents` + fallback semantics.
3. Migrate state: broadcasts → table; last call → VenueFloorState (swap the
   interface plan 05 stubbed); show lock → ActiveShow with lock; chat → table.
4. Page-by-page: replace each interval with the hook (guest waiting/orders, staff
   home/orders + banner, manager dashboard/orders). One commit per page.
5. Rename `pulseService`/`showQueueService`; staff-service chat methods real;
   delete the six polling TODOs + pulse/show/chat TODOs.

## Testing

- Unit: event-to-audience filter matrix (guest never sees cross-table events).
- Integration: publish → NOTIFY → stream delivery (two subscribed test clients);
  concurrent `startShow` yields exactly one winner (INV-F1); last-call flag
  gates `submitOrder` live.
- E2E (Playwright, two browser contexts — the real R6 proof): staff A claims,
  staff B sees it < 2 s without reload; manager broadcast appears on staff
  context; last call locks the guest context's menu live.

## Review checklist

- Does every stream authenticate/authorize its scope before subscribing?
- Fallback: kill the stream mid-E2E — does polling resume and recover?
- Serverless fit: stream route runtime/duration configured per AD-6's constraints?

## Exit criteria

Zero `setInterval` polls left as primary mechanism (grep `setInterval(refresh`);
two-device demo is genuinely live; the /demo tour's "within one poll" wording
updated (§9.9).
