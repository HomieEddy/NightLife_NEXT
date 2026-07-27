# 28 — PWA & Web Push · PLAN

**Status: not started.**

Goal: make the app installable as a PWA (manifest, icons, service worker),
add **web push** as the third channel on the plan-18 dispatch layer so floor
staff get phone notifications for events they currently only see by watching
the screen, and ship a **notification preferences UI** that lets each user
control which channels (push, email, SMS) fire for which events. A
bartender with the app installed and the phone in their pocket — receiving
only the alerts that matter to their role — is the product moment this plan
buys. Preferences naturally live here because push is the channel that
makes fine-grained control feel worthwhile: once you can receive three
channel types, you need a place to tune them.

Preconditions: plan 25 complete (dispatch core, `NotificationLog`); plan 07
realtime (the domain events in `src/server/events.ts` are the triggers push
subscribes to). Plan 26 is independent. Branch `feature/28-pwa-web-push`.

## Reasoning

1. **Why PWA, not native:** native apps sit in the Phase-3 parking lot for a
   reason — two app stores, review cycles, a second codebase. A PWA gets
   home-screen install, standalone chrome, and push on both platforms
   (iOS ≥ 16.4 requires the app be installed to Home Screen for push — an
   acceptable constraint since staff install once during onboarding; the
   install prompt copy must say so on iOS).
2. **Push complements SSE, it doesn't replace it.** Plan 07's `useLiveEvents`
   is the in-app realtime spine and stays untouched. Push covers the
   app-closed/phone-locked case only. The dispatch layer decides: an event
   notifies via push only when no recent SSE consumption suggests the user
   is looking at the app — v1 simplification: always push to subscribed
   staff for their role-relevant events; dedup/presence heuristics are a
   `TODO(backend)` earned by real complaint, not speculation.
3. **No `next-pwa`, no workbox.** The service worker this plan needs is
   ~40 lines: `push` event → `showNotification`, `notificationclick` →
   focus/open the right page. Offline caching is explicitly parked
   (parking lot: offline mode) — a caching SW done casually breaks deploys
   (stale HTML) and earns nothing yet. Hand-rolled file in `public/sw.js`,
   per §2.4: earn every dependency. `web-push` (the npm lib for VAPID
   signing) is the one earned dependency — signing Web Push payloads by
   hand is crypto we shouldn't hand-roll.
4. **Track placement:** the manifest/install surface ships in **both**
   builds (a demo visitor installing the demo is fine and good marketing).
   Push is live-track only: it needs a server, subscriptions, and VAPID
   keys; in demo mode the notification-settings surface renders a demo
   explainer instead (gated `isDemoMode()`).

## Design choices

- **Manifest via `src/app/manifest.ts`** (Next metadata route): name/short
  name per build mode (NightLife vs NightLife Demo), luxe theme colors from
  plan-11 tokens, `display: standalone`, icons generated once into
  `public/icons/` (192/512 + maskable). Role areas share one manifest —
  start_url `/` routes by role via the existing login flow.
- **Service worker:** `public/sw.js`, registered from a tiny client helper
  in `src/lib/pwa.ts` (registration is idempotent, skipped when
  unsupported). Scope: push display + click routing only. Versioned by
  content hash query so deploys refresh it.
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
  below):** `order.placed` → runners/bartenders of the zone;
  `help.requested` → staff; `order.claimed` → the claiming race's losers
  see nothing; managers can subscribe to escalations (unclaimed order past
  SLA — reuses the pulse SLA logic). Guest push is out of scope — guests
  are a QR session, not an installed app.
- **`NotificationPreferences` Prisma model** — venueId, userId (unique
  together), then one boolean per (event × channel) combination:
  `orderPush`, `orderEmail`, `orderSms`, `helpPush`, `helpEmail`,
  `helpSms`, `escalationPush`, `escalationEmail`, `escalationSms`.
  Defaults are role-appropriate and set on first save (runners default
  `orderPush=true`, managers default `escalationPush=true`, all SMS off
  until the user explicitly enables it). Tenant-scoped, read by the
  dispatch layer to decide which channels fire per recipient. Route:
  `GET/PUT /api/notifications/preferences` (session-authed, Zod-validated,
  full-replace semantics — the client sends the whole object).
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

1. Manifest + icons + SW registration; verify install on Android/desktop
   and iOS standalone (both builds).
2. Prisma `PushSubscription` + `NotificationPreferences` + migration;
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

- SW does **no** fetch/caching interception — push and click only.
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

The app installs to a phone home screen from staging; a subscribed staff
member with push enabled receives an order notification that opens the
right page on tap; disabling that event type in preferences silences push
while email/SMS remain unaffected; dead subscriptions self-clean on 410;
demo mode shows the explainer without prompting for permission; and no
offline/caching behavior shipped. Notification preferences UI is removed
from the parking lot.
