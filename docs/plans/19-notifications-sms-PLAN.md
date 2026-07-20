# 19 — SMS Notifications (Twilio) · PLAN

**Status: not started.**

Goal: add SMS as the second channel on the plan-18 dispatch layer and use it
to deliver what email can't reliably reach in a nightclub context: the
reservation PIN (plan 13's explicit TODO — a guest standing at a table needs
the code *now*, not in a spam folder) and reservation confirmations/reminders
for guests who gave a phone number instead of an email.

Preconditions: plan 18 complete (dispatch core, `NotificationLog`,
`EMAIL_DRIVER` pattern to mirror); plan 13's `guestPhone` and
`reservationPin` schema fields (committed). Branch
`feature/19-notifications-sms`.

## Reasoning

1. **Why SMS at all:** the PIN gate (plan 13) is the forcing function. A
   confirmed reservation locks the table's QR behind a 6-digit PIN; today
   nothing delivers that PIN to the guest. Email works for the booking-time
   confirmation, but the at-the-door moment is phone-shaped. Reminders
   ("your table at NightLife is held until 23:00") are the second use — they
   directly reduce no-shows, the metric plan 09c started tracking.
2. **Why Twilio:** boring, dominant, first-class Canadian number support,
   usable pay-as-you-go at pre-revenue volume. No abstraction over multiple
   SMS providers — one provider, one thin transport, same as Resend. If a
   cheaper provider matters later, the transport file is the seam.
3. **Compliance is a design input, not an afterthought.** Quebec/Canada:
   CASL governs commercial electronic messages and Law 25/PIPEDA govern the
   phone number as PII. Everything this plan sends is **transactional** —
   triggered by the guest's own reservation, factual, no promotion — which
   is CASL's safest category. Still: collection is opt-in (the phone field
   on the public reservation form states what it's used for), every SMS
   identifies the venue, and "Reply STOP" handling comes free with Twilio's
   default opt-out management. Marketing SMS is explicitly out of scope and
   stays out until plan 22's consent infrastructure exists.
4. **Track placement:** live-track, same shape as plan 18 — server-side side
   effect, no demo analog. The demo reservation flow shows the PIN on-screen
   after booking (that on-screen reveal becomes the demo simulation; the
   live flow shows "PIN sent to your phone" instead, gated with
   `isDemoMode()` in the same PR).

Out of scope: two-way SMS conversations, delivery-status webhooks beyond a
basic status callback, WhatsApp, marketing campaigns, per-guest notification
preferences.

## Design choices

- **`src/server/notifications/sms.ts`** — Twilio transport mirroring
  `email.ts`: `SMS_DRIVER=twilio|log` (default `log`), fail-closed boot
  check for `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM` when
  `twilio` is set. Dispatch (`dispatch.ts`) gains the channel; recipients
  with a phone and no email get SMS, with both get email + SMS for the PIN
  (the PIN is the one message worth double-delivery), email-only otherwise.
- **Templates are plain strings** in `src/server/notifications/sms-templates.ts`
  — SMS has no markup; keep each under 160 chars where possible (one
  segment, one price). Venue name leads every message. French/English
  follows the venue's guest-facing language once that setting exists; until
  then, French-touched English matching the demo's voice.
- **Phone normalization at the boundary:** E.164 via a small pure helper in
  `src/lib/` (validated by Zod at the API edge, AD-7) — stored normalized,
  rendered formatted. No libphonenumber dependency; Canadian/US NANP
  normalization is a 20-line function with unit tests (earn the dependency
  when a non-NANP market exists).
- **Cost guards:** per-venue daily SMS cap (config constant, logged when
  hit) and the existing `checkRateLimit` on the public reservation endpoint
  so the form can't be scripted into a Twilio bill. Every send logs cost
  segments to `NotificationLog.meta`.
- **Send points:** PIN on reservation `confirmed` (with `guestPhone`);
  confirmation SMS when phone-only; reminder via a `/api/jobs/reservation-reminders`
  cron handler (plan 18's pattern: `CRON_SECRET`, `job_runs`, idempotent per
  reservation) firing a configurable window before the slot.

## Implementation strategy

1. E.164 helper + unit tests; Zod phone validation on the public
   reservation input.
2. `sms.ts` transport + driver config; templates file.
3. Dispatch channel resolution (email/SMS/both) + `NotificationLog` rows.
4. Send points: PIN + confirmation on the `confirmed` transition; delete the
   plan-13 `TODO` for PIN delivery in the same commit.
5. `/api/jobs/reservation-reminders` cron handler; HOSTING.md cron table
   gains the row.
6. Demo gate: on-screen PIN reveal wrapped in `isDemoMode()`; live shows the
   sent-to-phone message.
7. `.env.example`: `SMS_DRIVER`, `TWILIO_*`; per-venue cap constant.

## Testing

- Unit: E.164 normalization (NANP happy paths, garbage, extensions);
  channel resolution matrix (email/phone/both/neither); segment-length
  assertions on every template; daily-cap enforcement.
- Integration (PGlite): confirming a reservation with a phone writes an SMS
  `NotificationLog` row; reminder cron is idempotent per reservation;
  cron auth 401; `expectTenantIsolation()`; the public endpoint's rate
  limit actually blocks a burst.
- Behavioral (§5): `dev:pglite`, `SMS_DRIVER=log` — book via `/r/[slug]`
  with a phone number, confirm as manager, verify PIN payload in stdout and
  the QR gate accepts it; demo mode still shows the on-screen PIN.
  Staging smoke: one real Twilio send to the team's phone before release.

## Review checklist

- No marketing content in any template; venue identified in every message.
- PIN never appears in app logs (only `NotificationLog`, plan 22 retention).
- Demo build shows on-screen PIN, live build never does — both modes driven.
- Cap + rate limit actually enforced (test proves it, not the code comment).
- Twilio creds only via env; absent in demo build entirely.
- Plan-13 PIN-delivery `TODO` deleted; ROADMAP parking-lot entry removed.

## Exit criteria

A guest booking on staging with a phone number receives their PIN and
confirmation by real SMS, the reminder job fires idempotently on schedule,
scripted form abuse is provably capped, and the demo sandbox keeps its
on-screen PIN reveal untouched.
