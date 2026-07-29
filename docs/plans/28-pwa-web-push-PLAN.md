# 28 — PWA & Web Push · PLAN

**Status: not started — demo track first (AD-14). Depends on plan 25.**

Goal: make the app installable as a PWA with full offline resilience (manifest,
icons, app shell with cache-first SW, offline action queue, offline indicator,
update lifecycle), add **web push** as the third channel on the
plan-25 dispatch layer so floor staff get phone notifications for events they
currently only see by watching the screen, and ship a **notification preferences
UI** that lets each user control which channels (push, email, SMS) fire for which
events. A bartender with the app installed and the phone in their pocket —
receiving only the alerts that matter to their role — is the product moment this
plan buys. Preferences naturally live here because push is the channel that
makes fine-grained control feel worthwhile.

Preconditions: plan 25 complete (dispatch core, `NotificationLog`); plan 07
realtime (the domain events in `src/server/events.ts` are the triggers push
subscribes to). Plan 26 is independent. Branch `feature/28-pwa-web-push`.

## Reasoning

1. **Why PWA, not native:** native apps sit in the Phase-3 parking lot for a
   reason — two app stores, review cycles, a second codebase. A PWA gets
   home-screen install, standalone chrome, and push on both platforms
   (iOS >= 16.4 requires the app be installed to Home Screen for push — an
   acceptable constraint since staff install once during onboarding; the
   install prompt copy must say so on iOS).
2. **Push complements SSE, it doesn't replace it.** Plan 07's `useLiveEvents`
   is the in-app realtime spine and stays untouched. Push covers the
   app-closed/phone-locked case only. The dispatch layer decides: an event
   notifies via push only when no recent SSE consumption suggests the user
   is looking at the app — v1 simplification: always push to subscribed
   staff for their role-relevant events; dedup/presence heuristics are a
   `TODO(backend)` earned by real complaint, not speculation.
3. **Full PWA scope per AD-19, not push-only.** The service worker handles
   three responsibilities, not one: (a) cache-first app shell for instant
   subsequent loads, (b) push event display + notification click routing,
   (c) offline action queue sync. Offline resilience is a stated product
   requirement (PRD R17) and is required for the Lighthouse PWA score >= 90
   exit criterion. The SW is hand-rolled in `public/sw.js` — `web-push`
   (the npm lib for VAPID signing) is the one earned dependency.
4. **Track placement:** the manifest/install + offline surfaces ship in
   **both** builds (a demo visitor installing the demo is fine and good
   marketing). Push is live-track only: it needs a server, subscriptions,
   and VAPID keys; in demo mode the notification-settings surface renders a
   demo explainer instead (gated `isDemoMode()`).

## Design choices

- **Manifest via `src/app/manifest.ts`** (Next metadata route): name/short
  name per build mode (NightLife vs NightLife Demo), luxe theme colors from
  plan-11 tokens, `display: standalone`, icons generated once into
  `public/icons/` (192/512 + maskable). Role areas share one manifest —
  start_url `/` routes by role via the existing login flow.
- **Service worker:** `public/sw.js`, registered from a tiny client helper
   in `src/lib/pwa.ts`. Three responsibilities per AD-19:
   - **Cache-first app shell:** HTML, CSS, JS bundles cached on install;
     network-first for API data. App shell renders instantly from cache;
     data fills in from network with skeleton states.
   - **Push display + click routing:** `push` event → `showNotification()`;
     `notificationclick` → focus/open the right page.
   - **Offline queue sync:** on `sync` event, replay queued actions
     (see offline queue below).
   Versioned by content hash query so deploys refresh it. SW size target
   < 100 KB.
- **App shell:** `src/lib/app-shell.tsx` wraps all staff/guest surfaces.
  Shell renders instantly from cache; data fills in from network. Skeleton
  states shown while fetching.
- **Offline queue** (`src/lib/offline-queue.ts`):
  - localStorage-backed queue for user actions taken while offline.
  - **Queueable commands:** `placeOrder`, `fileIncident`, `clockIn`, `clockOut`.
    Each queued action carries: `{ commandId: cuid(), command, payload,
    queuedAt, userId, venueId }`.
  - **Server idempotency:** replay de-duplicates by `commandId` — same command
    replayed twice produces the same result, never a duplicate side effect.
  - **Identity binding:** queued actions are bound to the user session active
    at queue time. On reconnect, if the session has changed (different user,
    expired token), queued actions are rejected with a "session changed —
    login required" notice, not silently replayed under a new identity.
  - **Sensitive data restriction:** no document images, full DOB, or ID numbers
    are written to localStorage. Door admission payloads carry only the
    admission type, party size, and profile ID reference — never the raw
    ID-check data.
  - **Conflict recovery:** if a queued action fails on replay (e.g. order item
    no longer available, shift already clocked), the action is marked
    `failed` with the server error. The staff member sees a banner on next
    login listing failed queue items with per-item retry/skip controls —
    never silent discard.
  - Queue replays in FIFO order on connectivity restore (online event).
    Actions that depend on server state (`claimOrder`) are excluded from the
    offline queue — they show "offline — try when connected."
- **Offline indicator:** persistent banner when `navigator.onLine === false`.
  Non-critical actions (browsing menu, viewing history) remain available.
  Critical actions (door admission, incident filing) available via offline
  queue.
- **Update lifecycle:** SW checks for updates on navigation. If new version
  available, show banner "New version available — tap to refresh." Never
  auto-refresh during active use.
- **Subscriptions:** `PushSubscription` Prisma model — venueId, userId,
  endpoint (unique), keys, userAgent, createdAt. Registered via
  `POST /api/push/subscriptions` (session-authed, Zod-validated), removed on
  unsubscribe or on a `410 Gone` from the push service (dead subscriptions
  self-clean at send time). Tenant-scoped like everything else.
- **Dispatch channel:** `push.ts` transport using `web-push` + VAPID keys
  (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`, fail-closed in
  live when unset; `PUSH_DRIVER=webpush|log` mirrors plan 25). Payloads are
  small JSON: title, body, URL to open. One `NotificationLog` row per
  attempt, dead-endpoint cleanup recorded.
- **Wired events (staff/manager, controlled per-user by preferences — see
   below):** staff role-relevant events per the roadmap notification trigger
   table (PSH-09); guest push follows the same dispatch layer for order
   status updates, table-ready alerts, and reservation reminders per PRD R17.
   Guest push subscription is per-guest-session, not per-user-account — the
   subscription is linked to the `GuestSession`, revoked on session close,
   and routed through the same `push.ts` transport.
- **`NotificationPreferences` Prisma model** — `{ venueId, userId,
   preferences: NotificationPreference[] }` where each
   `NotificationPreference` is `{ channel: "push"|"email"|"sms",
   eventType, enabled }`. Per-channel per-event-type booleans, matching
   AD-20 and DDD INV-N1. No flat boolean columns per (event × channel)
   combination — the array model scales to new event types without schema
   changes.
   Defaults are role-appropriate and set on first save. Tenant-scoped, read
   by the dispatch layer to decide which channels fire per recipient.
   Route: `GET/PUT /api/notifications/preferences` (session-authed,
   Zod-validated, full-replace semantics).
- **Quiet hours:** `{ startTime, endTime, timezone }` per user. Non-critical
   notifications suppressed during quiet hours; critical notifications
   (emergency, security alert, incident escalation) bypass (INV-N4).
- **Delivery tracking:** `NotificationLog` rows per attempt with status
   `sent`/`delivered`/`failed`/`clicked`. Dead subscriptions self-clean on
   `410 Gone` from push service. Retry with exponential backoff (max 3
   retries over 10 minutes, per AD-22).
- **UI: a "Notifications" section in staff/manager settings** (the existing
  settings pages already have a card-based layout — a new card fits without
  new routes). Three zones in the card:
  1. **Push** — "Enable push notifications" toggle (asks permission,
     subscribes, shows iOS install hint when needed). Disabled state
     explains what push is before prompting.
  2. **Per-event toggles** (row per event, column per available channel) —
     push/email/SMS checkboxes per event type, channels hidden if not
     available (SMS only shows if the venue has it configured; email always
     shows). Labels use the role's vocabulary (runners see "New order in my
     zone", not "order.placed").
  3. **Demo mode**: renders a static explainer card — no permission prompt,
     no API calls, no misleading toggles. (`isDemoMode()` gate, same
     pattern as plan 25's demo no-op.)
  Permission is only ever requested from the push toggle tap — never on
  page load.

## Implementation strategy

1. Manifest + icons + SW registration; SW handles cache-first shell, push
   events, and offline queue sync. Verify install on Android/desktop and iOS
   standalone (both builds). App shell wraps all staff/guest surfaces.
2. Offline queue (`src/lib/offline-queue.ts`): localStorage queue with
   `commandId`-based idempotency, identity binding, sensitive-data
   restrictions, and conflict-recovery UI. `OfflineIndicator` component.
3. Prisma `PushSubscription` + `NotificationPreferences` + migration;
   subscription and preferences API routes with Zod + session auth +
   tenant scoping; role-appropriate defaults on first write.
3. `push.ts` transport + VAPID config; dispatch channel reads preferences
   before deciding channels; dead-endpoint cleanup.
4. Event wiring off `src/server/events.ts` publishes (same seam SSE uses —
   no new event sources invented).
5. Settings UI: push toggle + per-event/per-channel preference grid + demo
   explainer gate. Extend the existing settings card layout — no new routes.
6. `.env.example`: VAPID vars, `PUSH_DRIVER`; HOSTING.md note on generating
   VAPID keys per environment.

## Testing

- Unit: payload shaping per event type; channel resolution honours
  preferences (push disabled → no push row in `NotificationLog` even for
  a subscribed user); dead-endpoint (410) removes the subscription row;
  role-appropriate defaults applied on first `PUT`.
- Integration (PGlite): subscribe/unsubscribe routes — session required,
  wrong-role 403 where applicable, `expectTenantIsolation()` on both
  `PushSubscription` and `NotificationPreferences` queries; `order.placed`
  with `orderPush=false` produces no push `NotificationLog` row; with
  `orderEmail=true` produces an email row; preferences `PUT` is
  idempotent and full-replace.
- Behavioral (§5): compose stack, `PUSH_DRIVER=log` — open settings as
  staff, toggle event types, place a guest order, confirm only the enabled
  channels appear in logs; disable all push events, re-place — confirm no
  push log row; then one real end-to-end on staging: install on a physical
  phone, lock it, configure preferences, place an order, feel the buzz (or
  not, if push is off). That last check cannot be skipped.
- Both builds: demo mode shows the static explainer, never prompts for
  permission, preference toggles absent; manifest installs in both;
  `npx next build` green in both modes.

## Review checklist

- SW handles three responsibilities: cache-first shell, push events, offline
  queue sync — not push-only.
- App shell renders from cache on repeat visits; SW update lifecycle tested
  across all staff roles.
- Offline queue: `commandId`-based idempotency on server, identity binding
  rejects replays after session change, no sensitive payloads written to
  localStorage, conflict-recovery UI for failed replays.
- Permission prompt only from the explicit push toggle tap — never on load.
- `PushSubscription` and `NotificationPreferences` both tenant-scoped; a
  venue's event never pushes to another venue's staff (tests prove it).
- Dispatch reads preferences before any send — a disabled channel produces
  zero `NotificationLog` rows (test proves it, not the code comment).
- Preference defaults are role-appropriate and applied exactly once on
  first write — not overwritten on subsequent saves.
- VAPID private key server-only; public key via config, not hardcoded.
- SSE paths untouched — no page stops streaming because push exists.
- iOS constraint in the settings UI copy; SMS channel hidden when the venue
  hasn't configured it (don't show a toggle for something that can't fire).
- Demo mode: explainer only, zero API calls, no misleading toggles.

## Exit criteria

The app installs to a phone home screen from staging; the app shell loads
instantly from cache on repeat visits; queued offline actions sync on reconnect
with idempotency and identity binding; a subscribed staff member with push
enabled receives an order notification that opens the right page on tap;
disabling that event type in preferences silences push while email/SMS remain
unaffected; dead subscriptions self-clean on 410; demo mode shows the explainer
without prompting for permission; SW update lifecycle tested across staff roles;
Lighthouse PWA score >= 90. Notification preferences UI is removed from the
parking lot.
