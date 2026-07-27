# 17 — Door, Arrival, Guest Identity & Safety · PLAN

**Status: not started — demo track first (AD-14).**

Goal: the app currently begins when a guest is already sitting at a table with a
QR code in front of them. This plan builds everything **before** that moment —
the sidewalk to the seat — and the safety record that a door creates. It adds a
door surface with live occupancy, an arrival/admission log, a walk-in waitlist, a
unified check-in for reservations and guestlists, a persistent **guest identity**
(so a regular is recognised and a banned patron is refused), an **incident
report** system that finally gives the `security` role a domain instead of a
filtered help queue, and four safety capabilities required before a real venue
opens its doors:

- **S-01 Age verification enforcement** — DOB calculation against configurable
  legal drinking age, blocked admission for underage guests with mandatory denial
  reason recording.
- **S-02 Mandatory incident reporting** — reportable flag, regulatory deadline
  tracking, authority reference field, overdue-report escalation in the Pulse feed.
- **S-03 Emergency evacuation** — one-action evacuation workflow: zero occupancy
  delta, emergency broadcast to all channels, headcount ledger entry, manager
  override to resume normal operations.
- **S-04 Certification tracking** — certification type, expiry date, renewal
  scheduling, shift-publish enforcement for expired certifications, expiry
  warnings at 30/14/7 days. Certification data model and enforcement logic ship
  here; the workforce plan (18) consumes certification state when publishing
  shifts and staffing schedules.

Preconditions: plan 08 (reservations/events), plan 13 (public reservations, PIN
gate), plan 15 (floor-role matrix — security is a first-class role), plan 16
(audit trail — refusals and ejections write to it).

Closes: `docs/BUSINESS-LOGIC-GAP-REVIEW.md` §1 in full, §4 in full, §5 in full,
and §7 except data-retention (plan 29).

## Reasoning

The review calls the door "the most consequential gap" and it is also the one
place where three separate absences turn out to be a single missing entity. You
cannot count occupancy without recording arrivals. You cannot record an arrival
usefully without knowing *who* arrived. You cannot refuse entry to someone you
have no record of. So: **`GuestProfile` + `Admission` are the spine**, and
waitlist, check-in, VIP recognition, ban list and incident reports all hang off
them.

Interpretation choices (per AGENTS.md §1.4):

- **The door is a phone surface, not a desk app.** The people working it are
  security and hosts, standing, in the cold, one-handed. Every door interaction
  is designed as a single large tap: **+1 in**, **−1 out**, **scan/search →
  admit**. Anything requiring two hands belongs on the manager side.
- **Occupancy is a counter, not an inference.** We do *not* derive it from
  seated tables — most of a nightclub's room is not at a table. The counter is
  the legal number, incremented and decremented by the door, with table sessions
  shown alongside as context.
- **Identity is pseudonymous-by-default and opt-in.** The PRD's privacy stance
  (§7: guests are pseudonymous, first name only) is preserved for QR guests. A
  `GuestProfile` is created only when someone *gives* us identity — a
  reservation, a guestlist entry, a door ID check, or a host tagging a regular.
  QR sessions link to a profile only if a host attaches one. This keeps Law 25
  exposure proportional and is the difference between a CRM and surveillance.
- **ID verification records the *check*, not the document.** We store
  `idCheckedBy`, `idCheckedAt`, `dobVerified: boolean` and optionally a year of
  birth — never a scan, never a document number. Storing ID images would be a
  liability we have no reason to accept.
- **"Cover charge" records an admission type, not a payment.** Payment
  processing stays out of scope (PRD §4); `admissionType` (`guestlist`, `comp`,
  `cover`, `reservation`, `member`) and an `amountOwedCents` are recorded so the
  door reconciles against the till like everything else.
- **Incidents are the security role's core object**, not an afterthought — they
  are the reason a venue keeps its licence.
- **Privacy minimums apply from the first PII-producing plan.** Guest profiles,
  incidents, and ID checks create personal information subject to Law 25/PIPEDA
  before plan 29 ships. Minimum controls required in this plan: (1) no document
  images or ID numbers stored — ID checks record year of birth and verification
  status only, per AD-17; (2) guest profiles are opt-in per AD-17 — anonymous QR
  sessions create no profile; (3) incident retention labels are set at creation
  time (incidents with `reportable: true` carry `retainUntil` far-future;
  non-reportable incidents default to plan 29's standard retention); (4) all new
  tables carrying PII (`GuestProfile`, `Incident`, `Admission.idCheck`) are
  scoped to `venueId` and the tenant-isolation canary test extends to them.
  Plan 29 adds the full retention enforcement, deletion paths, consent
  management, and breach register.

## Design choices

### Data model

- **`GuestProfile`** (root, tenant-scoped) —
  `{ id, venueId, displayName, firstName, lastName?, phone?, email?, dobYear?,
  tags: GuestTag[], vipTier?: "none"|"regular"|"vip"|"host-list", status:
  "active"|"banned", banReason?, bannedUntil?, bannedByStaffId?, notes,
  marketingConsent: { email: bool, sms: bool, capturedAt, source },
  createdAt, lastVisitAt, visitCount, lifetimeNetCents }`.
  `lifetimeNetCents` and `visitCount` are **rollups**, recomputed from sessions
  (AD-11 pattern) — never hand-edited.
- **`GuestLink`** — the join that keeps identity opt-in:
  `{ guestProfileId, sessionId? , reservationId?, eventGuestId?, admissionId? }`.
  A `GuestSession` with no link is exactly today's anonymous QR guest.
- **`Admission`** (append-only) —
  `{ id, venueId, businessDate, guestProfileId?, partySize, admissionType,
  amountOwedCents, source: "walk-in"|"reservation"|"guestlist"|"re-entry",
  reservationId?, eventGuestId?, idCheck: { checked, dobVerified, byStaffId, at }?,
  admittedByStaffId, admittedAt, exitedAt?, reEntryOfAdmissionId? }`.
- **`OccupancyEvent`** (append-only) — `{ id, venueId, delta, reason, staffId,
  at }`. Current occupancy = `Σ delta` for the business date. Same ledger
  discipline as `StockMovement` (INV-I1): corrections are new rows.
- **`Venue`** gains `legalCapacity`, `occupancyWarnRatio` (default 0.9),
  `coatCheckEnabled`, `doorRequiresIdCheck`.
- **`WaitlistEntry`** — `{ id, venueId, guestProfileId?, name, partySize, phone?,
  quotedMinutes, status: "waiting"|"notified"|"seated"|"left"|"expired",
  joinedAt, notifiedAt?, position }`. Position is derived from `joinedAt` within
  status `waiting`, never stored as a mutable int (that field always rots).
- **`CoatCheckTicket`** — `{ id, venueId, businessDate, ticketNumber,
  guestProfileId?, itemCount, checkedInAt, claimedAt?, staffId }`.
  Gated by `venue.coatCheckEnabled` so venues that don't run one see nothing.
- **`Incident`** (root) — `{ id, venueId, businessDate, type: "ejection"|
  "refused-entry"|"medical"|"altercation"|"theft"|"property-damage"|"police"|
  "other", severity: "low"|"medium"|"high", occurredAt, zoneId?, tableId?,
  guestProfileId?, involvedStaffIds, narrative, actionsTaken,
  policeInvolved: bool, reportedByStaffId, status: "open"|"resolved",
  attachments: never (v1) }`. Immutable narrative after submit; follow-ups are
  appended `IncidentNote` rows. Writes an `AuditEntry` (plan 16).
- **`RefusalOfService`** — modelled as an `Incident` of type `refused-entry`
  rather than a separate table; a refusal that involves a known profile can set
  `status: "banned"` on that profile in the same transaction.
- **`ReservationStatus`** gains **`no-show`** (the review's small-change /
  large-value item). `Reservation` gains `expectedDurationMinutes`,
  `depositTermsNote`, `cancellationPolicyNote` (terms recorded, not charged),
  and `seatingNumber` (1st or 2nd seating).
- **`EventGuest`** stops being explicitly non-identity: it gains an optional
  `guestProfileId` so a repeat guestlist name resolves to a regular.

### Behaviour

**Door surface — `/staff/door`** (security + host + manager per the matrix):

- **Occupancy header**: big current count / legal capacity, colour-shifting past
  `occupancyWarnRatio`, with **+1 / −1** thumb targets and a party-size stepper.
  A `capacity-warning` attention item feeds the manager Pulse at the ratio and a
  `capacity-critical` at 100%.
- **Arrivals list + search**: one search box across tonight's reservations,
  guestlists and known profiles. Result → **Admit** sheet: party size,
  admission type, ID check toggle (forced when `doorRequiresIdCheck`), notes.
  Admitting a reservation sets it `seated`-eligible and stamps the arrival;
  admitting a guestlist entry sets `checked-in`. **One flow, three sources** —
  this is what today's event-only check-in isn't.
- **Ban check is automatic and blocking**: matching a banned profile shows a
  full-bleed refusal card with the reason and who set it; admitting anyway
  requires a manager capability and writes an audit entry.
- **Waitlist**: add a walk-in in three taps; the list shows quoted vs. elapsed;
  when a table frees, the floor map / tables page offers "seat from waitlist"
  with the top-N matching parties by size. Notification is plan 26 (SMS) — until
  then the entry is marked `notified` manually.
- **Re-entry**: scanning/searching an already-admitted guest offers "re-entry"
  which reuses the admission and adjusts occupancy without double-counting the
  cover.
- **Coat check**: number in, number out, claimed state. Deliberately minimal.

**Incidents — `/staff/incidents` (security) and `/manager/incidents`:**

- Report form is short and structured: type, severity, time, where, who, what
  happened, what we did. Draft autosaves; submit is a `ConfirmDialog` that states
  the record is permanent.
- Security's Home gains open-incident count and the occupancy figure — their
  panel becomes *door + trouble + hours + radio*, which is the actual job.
- Manager view filters by date/type/severity, exports to the report engine.

**Guest identity in the flow — recognition where it matters:**

- **Session approval** (the review's "highest-value moment") shows, when a
  profile is linked: visit count, lifetime net, VIP tier, allergy/preference
  notes, and any open flag. This is the single highest-perceived-value screen in
  the plan.
- **Reservation form** searches existing profiles before creating a new one
  (dedupe on phone, then email, then name+DOB-year).
- **Guest merge tool** (manager) for the inevitable duplicates.
- **Responsible service**: a per-session drink counter derived from delivered
  order items flagged `isAlcoholic` (new `MenuItem` field, alongside `abv` and
  `allergens: string[]`), plus a "refuse further service" action on the session
  that records an `Incident` and blocks new orders for that session with a guest-
  facing explanation.

### Safety enforcement (S-01 through S-04)

**S-01 — Age verification enforcement:**

- `Venue` carries `legalDrinkingAge` (configurable, default 18 for Quebec).
- On admission, if `doorRequiresIdCheck` is true or the guest profile has no
  verified DOB on record, an ID check is mandatory before the admit action
  completes.
- `idCheck.dobVerified` stores the result; `idCheck.yearOfBirth` stores the
  verified birth year (never the full date unless the guest profile gives it
  explicitly — Law 25 minimization). Age is derived at admission time:
  `admittedAt.year - yearOfBirth` compared to `venue.legalDrinkingAge`.
  If underage: admission is **blocked** (not warned), admission type is set to
  `denied` with reason `underage`, and the blocking is audited. No override
  path exists — underage admission is a hard legal boundary.
- If the guest's profile carries a `dateOfBirth`, age is computed exactly
  (`admittedAt - dateOfBirth`). An underage guest with a DOB on file is
  blocked at the search/scan step before the admit sheet opens.

**S-02 — Mandatory incident reporting compliance:**

- `Incident` gains: `reportable: bool` (set by the reporting staff or during
  review), `regulatoryDeadline` (date, required when reportable),
  `reportedToAuthorityAt` (timestamp, recorded when the report is filed),
  `authorityReference` (free-text, e.g. case/file number from the regulator).
- An incident marked `reportable: true` with `regulatoryDeadline < now()` and
  no `reportedToAuthorityAt` generates a `mandatory-report-overdue` attention
  item in the Pulse feed and compliance calendar.
- The `Incident` model carries a `regulatoryAuthority` string field for the
  authority name (e.g. "Régie des alcools, des courses et des jeux").
- Overdue reportable incidents escalate: notification at 7 days before
  deadline, at deadline, and daily thereafter until `reportedToAuthorityAt`
  is set. The compliance calendar (Plan 29's retention job scope) surfaces
  these alongside certification expiries.

**S-03 — Emergency evacuation workflow:**

- `POST /api/floor/evacuate` (manager or security-lead capability,
  `emergency:evacuate`): in one transaction —
  1. Creates one `OccupancyEvent` with `delta = -(current occupancy)` and
     type `emergency-evacuation`, recording the current count as the
     `headcountAtEvacuation`.
  2. Sets a venue-wide `evacuationState` flag (`"normal"` | `"evacuating"` |
     `"evacuated"`).
  3. Publishes `EmergencyEvacuated` domain event with severity `critical`.
  4. Writes an `AuditEntry`.
- While `evacuationState !== "normal"`:
  - Door admission controls are disabled (no one can be admitted during an
    evacuation).
  - All SSE channels broadcast the evacuation state.
  - The Pulse feed shows a permanent `emergency-active` attention item.
- **Resume normal operations:** `POST /api/floor/evacuation-resume` (manager
  only, `ConfirmDialog`): sets `evacuationState` back to `"normal"`, creates
  an `OccupancyEvent` with `delta = headcountAtEvacuation` and type
  `emergency-resume`, and publishes `EmergencyResumed`. Audited.

**S-04 — Certification tracking:**

- **`Certification`** model (root, per staff member): `{ id, venueId, staffId,
  type: CertificationType, issuedAt, expiresAt, issuingBody?, referenceNumber?,
  documentUrl?, verifiedByStaffId?, verifiedAt?, status: "active"|"expired"|
  "revoked" }`.
- `CertificationType` is a venue-configurable enum seeded with common types:
  `smart-serve` (responsible alcohol service), `first-aid`, `security-guard`,
  `food-handler`, `crowd-manager`.
- **Enforcement:** a `Shift` cannot be published for a staff member whose
  `Certification` of a type required by their role is expired at the shift
  start time (INV-W9). Expiry within 30 days generates a
  `certification-expiring` attention item; overdue certifications generate
  a `certification-expired` attention item. Notifications at 30, 14, 7, and 1
  days before expiry via the notification dispatcher (AD-22).
- `Certification` rows are mutable with audit on expiry date changes; status
  derived from `expiresAt < now()`. Revocation is explicit (`status: "revoked"`),
  not inferred.

**S-13 — Legal capacity enforcement:**

- On admission, before the `OccupancyEvent` is written: current occupancy
  (Σ delta for business date) + party size is compared against
  `venue.legalCapacity`.
- If `currentOccupancy + partySize > legalCapacity`: admission is **blocked**
  with denial reason `capacity`. No occupancy event is written.
- A `capacity-warning` attention item fires at the `occupancyWarnRatio`
  (default 0.9); `capacity-critical` fires at 1.0.
- Concurrent admission from two door staff must be serializable: the
  occupancy check and increment use `SELECT ... FOR UPDATE` on the venue row
  or a dedicated advisory lock per venue per business date.
- A manager with `door:admit-capacity-override` capability can bypass the
  capacity check; override always writes an `AuditEntry` with the reason and
  the occupancy at override time.

### Capability matrix additions

| Action | manager | host | bartender | runner | security | promoter |
|---|---|---|---|---|---|---|
| `door:count` | ✓ | ✓ | — | — | ✓ | — |
| `door:admit` | ✓ | ✓ | — | — | ✓ | — |
| `door:admit-banned-override` | ✓ | — | — | — | — | — |
| `door:id-check` | ✓ | ✓ | — | — | ✓ | — |
| `waitlist:manage` | ✓ | ✓ | — | — | — | — |
| `incident:create` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `incident:read-all` | ✓ | — | — | — | ✓ | — |
| `guest:read-profile` | ✓ | ✓ | — | — | ✓ (flags only) | — |
| `guest:edit-profile` / `guest:ban` | ✓ | — | — | — | — | — |
| `guest:watchlist` | ✓ | ✓ | — | — | ✓ | — |
| `emergency:evacuate` | ✓ | — | — | — | ✓ (security-lead) | — |
| `emergency:resume` | ✓ | — | — | — | — | — |
| `door:admit-capacity-override` | ✓ | — | — | — | — | — |
| `incident:mark-reportable` | ✓ | — | — | — | ✓ | — |
| `certification:manage` | ✓ | — | — | — | — | — |
| `service:refuse` | ✓ | ✓ | ✓ | — | ✓ | — |

Everyone can *report* an incident — a runner who sees a fight must be able to
log it. Only manager and security read the full log.

### Analytics & feature gating

- New metrics: admissions by type and hour, door conversion (waitlist joined →
  seated), no-show rate by channel and by promoter, occupancy curve for the
  night, incident counts by type/severity, repeat-guest rate and share of
  revenue from returning guests (only now possible), guest lifetime value bands.
- New `FeatureKey`s: `door`, `guest-crm`, `incidents`. Door and incidents belong
  to every plan tier (safety is not an upsell); `guest-crm` is a Pro+ feature.

## Implementation strategy

Demo track, in dependency order:

1. **Types + pure functions**: profiles, admissions, occupancy, waitlist,
   incidents, coat check, reservation/menu field additions;
   `computeOccupancy()`, `waitlistPosition()`, `dedupeCandidates()`,
   `businessDateFor()` reuse. Unit tests first for occupancy and dedupe.
2. **Mock services**: new `door-service`, `guest-service` (profiles/merge/ban),
   `incident-service`, `waitlist-service`; extensions to `reservation-service`
   (no-show, seatings, terms) and `events-service` (profile-linked guestlist).
3. **Mock data**: a night's worth of profiles including three regulars with
   history, one banned patron, an in-progress waitlist, two seeded incidents,
   occupancy partway to capacity — so every new screen is non-empty on first
   paint (the plan-15 seeding standard).
4. **Capability matrix rows** + audit wiring.
5. **UI**: `/staff/door` (the big one), `/staff/incidents`, security Home
   variant, `/manager/guests`, `/manager/incidents`, `/manager/waitlist`
   (or a tab on reservations — decide in the preview), profile card on session
   approval, reservation form profile search, responsible-service controls.
6. **Pulse**: `capacity-warning`, `waitlist-overdue`, `incident-open` attention
   types.

Live track (graduation):

7. Prisma models; `occupancy_events`, `admissions`, `incident_notes` INSERT-only;
   occupancy read as a windowed aggregate with a covering index on
   `(venueId, businessDate)`.
8. Route handlers + Zod; domain events `GuestAdmitted`, `GuestExited`,
   `OccupancyChanged`, `WaitlistChanged`, `IncidentReported`,
   `GuestCheckedIn` (already reserved in DDD §3), `ReservationSeated`.
9. Retention: `GuestProfile` and `Incident` enter plan 29's retention schedule
   with explicit periods (incidents are kept longest — licence defence).

## Testing

- **Unit (test-first):** occupancy never goes negative and re-entry doesn't
  double-count; waitlist position stable under insert/leave; dedupe matches on
  phone before name; no-show only reachable from `confirmed`; drink counter
  counts only delivered alcoholic items; business-date rollover at
  `nightEndHour`.
- **Invariant canaries:** `INV-D1` occupancy = Σ `OccupancyEvent.delta` for the
  business date; `INV-D2` an `Incident` narrative is never updated after submit;
  `INV-D3` a banned profile cannot be admitted without the override capability
  and the override always leaves an audit entry.
- **Integration (live):** wrong-role 403 per new action (runner on
  `door:admit`, security on `guest:edit-profile`); tenant isolation on every new
  route (a profile from venue A never resolves in venue B's door search — this
  one is a privacy incident if it fails, test it explicitly); concurrent +1/−1
  from two devices reconciles.
- **E2E (demo):** security signs in → door shows 214/400 → admits a walk-in
  party of 4 with ID check → occupancy 218 → searches a reservation, admits and
  seats it → a banned name is refused and the refusal is logged as an incident →
  host approves that table's QR session and sees "VIP · 12 visits · $8.4k
  lifetime" → manager opens incidents and sees both records.

## Review checklist

- Is any guest PII created without an explicit act of the guest or staff? (The
  anonymous QR path must stay anonymous.)
- Is occupancy ever derived from table state anywhere? (It must not be.)
- Does the ban check run *before* the admit action can be tapped, not as a
  post-hoc warning?
- Are ID-check fields free of document numbers and images?
- Do incidents write audit entries in the same transaction, and are notes
  append-only?
- Does the door surface work one-handed at 3am — tap targets ≥ 56px, no nested
  dialogs, no typing required for the common path? (Judge this in the preview,
  on mobile viewport, not from the code.)
- `no-show` added to every place `ReservationStatus` is switched on — grep it.

## Exit criteria

A security member's phone opens on the door: a live occupancy count against
legal capacity, a search that resolves reservations, guestlists and regulars in
one box, a walk-in waitlist with quoted times, a refusal path that cannot be
bypassed silently, and an incident form that takes under a minute. A host
approving a table sees who the party is and what they're worth. A manager can
answer, the next morning, exactly how many people were in the room at 01:00, who
was refused and why, which reservations no-showed, and what happened at 02:40 —
and every one of those answers has a name attached to it.
