# Data Inventory & Retention Schedule

**NightLifeNext — Law 25 / PIPEDA compliance**
**Last updated: 2026-08-03**
**Status: proposed — retention numbers require owner sign-off**

This inventory maps every data class that contains personal information under
Law 25 and PIPEDA. It is generated from `prisma/schema.prisma` (the live data
model as of Phase 7 graduation) plus the new stores added by plans 31–33
(auth/request logs, error tracker, backups).

Each data class answers: **what**, **why**, **where**, **how long**, **lawful
basis**, and **deletion path**. Retention numbers marked `[OWNER REVIEW]` are
proposed defaults; the owner must approve them before production onboarding.

---

## 1. Venue staff (B2B employment context)

### 1.1 User account

| Field | Detail |
|---|---|
| **What** | `User`: name, email, image (avatar URL), isPlatformAdmin flag, role, ban status |
| **Why** | Authentication, authorization, account management |
| **Where** | `users` table (platform, no venueId) |
| **How long** | **Active accounts:** until deletion request. **Inactive accounts:** 24 months after last login, then anonymized (name → "Deleted User", email hashed, image cleared) `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity (employment relationship) + consent for image |
| **Deletion** | `scripts/privacy-erase.ts` per-request; retention job for inactive accounts |

### 1.2 Staff profile

| Field | Detail |
|---|---|
| **What** | `StaffProfile`: phone, role, avatarInitials, hourlyRateCents, tipPoolWeight, employmentType, assignedZoneIds, isOnShift |
| **Why** | Workforce management, scheduling, payroll, tip distribution |
| **Where** | `staff_profiles` table (platform, linked to User) |
| **How long** | **Active:** until staff member leaves venue. **Terminated:** 3 years after termination per Quebec labour law (CNESST record-keeping) `[OWNER REVIEW]` — note: this is longer than the privacy-minimization default; labour law floors take precedence |
| **Lawful basis** | Contract necessity + legal obligation (labour law) |
| **Deletion** | Anonymized via user deletion cascade; retained for statutory period post-termination |

### 1.3 Session tokens

| Field | Detail |
|---|---|
| **What** | `Session`: token, expiresAt, ipAddress, userAgent, impersonatedBy |
| **Why** | Authentication session management |
| **Where** | `sessions` table (platform) |
| **How long** | Token expiry + 7 days grace; expired tokens purged by retention job `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity |
| **Deletion** | Expired by Better Auth; retention job hard-deletes expired rows after grace period |

### 1.4 OAuth accounts

| Field | Detail |
|---|---|
| **What** | `Account`: providerId, accessToken, refreshToken, idToken, password (hashed), scope |
| **Why** | OAuth and password-based authentication |
| **Where** | `accounts` table (platform) |
| **How long** | Until account deletion (cascade) |
| **Lawful basis** | Contract necessity |
| **Deletion** | Cascade with User |

### 1.5 Verification tokens

| Field | Detail |
|---|---|
| **What** | `Verification`: identifier (email), value (token), expiresAt |
| **Why** | Email verification |
| **Where** | `verifications` table (platform) |
| **How long** | Token expiry + 24 hours; purged by retention job |
| **Lawful basis** | Contract necessity |
| **Deletion** | Retention job hard-deletes expired tokens |

### 1.6 Invitations

| Field | Detail |
|---|---|
| **What** | `Invitation`: email (prospective staff member), draftName, draftPhone, inviterId, role, floorRole, assignedZoneIds, expiresAt |
| **Why** | Staff onboarding — sent by venue manager to prospective staff |
| **Where** | `invitations` table (platform) |
| **How long** | 90 days after expiry `[OWNER REVIEW]` |
| **Lawful basis** | Pre-contractual measures (invitation is the offer) |
| **Deletion** | Retention job; cascade with User (inviter) |

### 1.7 Staff operational records (plan 18)

| Field | Detail |
|---|---|
| **What** | `TimeEntry`, `Shift`, `ShiftTemplate`, `TimeOffRequest`, `ShiftSwapRequest`, `ShiftCashout`, `CommissionStatement`, `CommissionRule`, `TipDistribution`, `StaffTableAssignment`, `ShiftHandoff`, `Certification`, `VenueRolePermissions` |
| **Why** | Scheduling, time tracking, payroll, tips, commissions, compliance certifications |
| **Where** | Various venue-scoped tables |
| **How long** | **Employment records (time/pay/tips/commissions):** 3 years per Quebec labour law. **Certifications:** until expiry + 1 year. **Shift schedules/templates:** 1 year after superseded. `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity + legal obligation |
| **Deletion** | Cascade with venue deletion; individual records held for statutory minimums |

### 1.8 Push subscriptions & notification preferences (plan 25)

| Field | Detail |
|---|---|
| **What** | `PushSubscription`: endpoint, keys (p256dh, auth), userAgent, userId. `NotificationPreference`: userId, eventType, channel, enabled. `UserQuietHours`: userId, startTime, endTime, timezone |
| **Why** | Push notification delivery, per-channel preferences, quiet hours enforcement |
| **Where** | Venue-scoped tables |
| **How long** | Until user deletion (cascade) or device rotation (expired rows purged after 30 days) |
| **Lawful basis** | Consent (push permission via browser API) + contract necessity |
| **Deletion** | Cascade with User; expired subscriptions purged by retention job |

---

## 2. Guests (consumer — highest sensitivity)

### 2.1 Guest profile (plan 17 — heaviest PII class)

| Field | Detail |
|---|---|
| **What** | `GuestProfile`: displayName, firstName, lastName, phone, email, dobYear, tags, vipTier, status, banReason, bannedUntil, bannedByStaffId, notes, marketingConsent (email/sms booleans + capturedAt + source), photoUrl, preferences (JSON: preferredDrink, preferredZone, dietaryRestrictions, allergies), valueScore, watchlist (JSON: reasons, tags), staffNotes (JSON: entries with author, timestamp, body), linkedProfileIds, lastVisitAt, visitCount, lifetimeNetCents |
| **Why** | Guest CRM: identity, preferences, visit history, VIP tiering, safety (bans, watchlist), marketing consent |
| **Where** | `guest_profiles` table (venue-scoped) |
| **How long** | **Active profiles:** until erasure request or 24 months since last visit (inactive). **Banned profiles:** until ban expiration + 30 days. **Watchlist entries:** reviewed quarterly, stale entries removed. **Photo:** deleted immediately on erasure request (arguably biometrically adjacent); retained only for active profiles. **Marketing consent records:** retained for 2 years after consent withdrawal per CASL. `[OWNER REVIEW]` |
| **Lawful basis** | Consent (marketing, photo), legitimate interest (CRM, safety/watchlist, VIP benefits), legal obligation (ban records — tied to safety) |
| **Special sensitivity** | Photos are arguably biometrically adjacent under Law 25. Medical information in `preferences.allergies` and incident `medicalChecklist` is sensitive personal information — see §8 for further notes. |
| **Deletion** | Soft-delete (CRM-07: active→deleted) already exists. Hard erasure: `scripts/privacy-erase.ts` reaches profile + notes + incidents-by-reference + photos + reservations + notification logs. Note: lifetime aggregates (visitCount, spend) survive anonymization in rollups — the person is erased, not the numbers. |

### 2.2 Guest links (cross-references within a venue)

| Field | Detail |
|---|---|
| **What** | `GuestLink`: guestProfileId, sessionId, reservationId, eventGuestId, admissionId |
| **Why** | Traces a guest profile across sessions, reservations, events, admissions |
| **Where** | `guest_links` table (venue-scoped) |
| **How long** | Until guest profile erasure (cascade) |
| **Lawful basis** | Legitimate interest (CRM cross-referencing) |
| **Deletion** | Cascade with guest profile erasure |

### 2.3 Guest referrals (plan 17)

| Field | Detail |
|---|---|
| **What** | `GuestReferral`: referrerProfileId, referredProfileId, source, status |
| **Why** | Guest referral tracking for promotional rewards |
| **Where** | `guest_referrals` table (venue-scoped) |
| **How long** | 12 months after referral status finalization `[OWNER REVIEW]` |
| **Lawful basis** | Consent (implied by participating in referral program) |
| **Deletion** | Cascade with guest profile erasure |

### 2.4 Guest sessions (plan 06)

| Field | Detail |
|---|---|
| **What** | `GuestSession`: displayName, partySize, promoterId, guestProfileId, hostStaffId, hostStaffName, serviceRefusedAt, serviceRefusedReason, settledExternallyAt, settlementMethod |
| **Why** | Table service session — ties orders to a table for a night |
| **Where** | `guest_sessions` table (venue-scoped) |
| **How long** | **Closed sessions:** 90 days, then anonymized (displayName → "Guest", promoterId → null, guestProfileId → null, hostStaffId → null, hostStaffName → "Staff"). **Open/pending:** retained. `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity (providing the service) |
| **Deletion** | Retention job anonymizes closed sessions; the `displayName` is a session-level field with no external linkage beyond the profile link — anonymizing it severs the tie without losing the operational record |

### 2.5 Session notes (plan 17)

| Field | Detail |
|---|---|
| **What** | `SessionNote`: note, createdByStaffId, createdByStaffName |
| **Why** | Staff notes on a guest session — service context |
| **Where** | `session_notes` table (venue-scoped) |
| **How long** | Same as parent GuestSession; anonymized with it |
| **Lawful basis** | Legitimate interest (service quality) |
| **Deletion** | Cascade with session anonymization |

### 2.6 Bar tabs (plan 17)

| Field | Detail |
|---|---|
| **What** | `BarTab`: guestProfileId, guestName, openedByStaffId, openedByStaffName, status |
| **Why** | Open bar tabs linked to guest profile |
| **Where** | `bar_tabs` table (venue-scoped) |
| **How long** | Closed tabs: 90 days after close. Open tabs beyond 48 hours: auto-closed then retained per closed-tab policy. `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity |
| **Deletion** | Cascade with guest profile erasure |

### 2.7 Orders

| Field | Detail |
|---|---|
| **What** | `Order`: guestName, claimedByStaffId, claimedByStaffName, giftToTableId, giftToTableCode, giftNote, rushedBy, promotionCode, plus financial fields (subtotalCents, tipCents, totalCents etc.) |
| **Why** | Order fulfilment, billing, staff performance |
| **Where** | `orders` table (venue-scoped); `order_items`, `fee_lines` (child tables) |
| **How long** | Until session anonymization (cascade). Financial aggregates in `NightlyRollup` survive — see §8. `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity |
| **Deletion** | Cascade with session; `guestName` on orders is session-level and anonymized with the session |

### 2.8 Help requests

| Field | Detail |
|---|---|
| **What** | `HelpRequest`: guestName, resolvedByStaffId, resolvedByStaffName |
| **Why** | Guest-to-staff assistance tracking |
| **Where** | `help_requests` table (venue-scoped) |
| **How long** | Until session anonymization (cascade) |
| **Lawful basis** | Contract necessity |
| **Deletion** | Cascade with session |

### 2.9 Reservations

| Field | Detail |
|---|---|
| **What** | `Reservation`: guestName, guestEmail, guestPhone, reservationPin (6-digit hash), partySize, note, promoterId, guestProfileId, bookingLocale, depositTermsNote |
| **Why** | Table booking — public or manager-created |
| **Where** | `reservations` table (venue-scoped) |
| **How long** | **Completed/cancelled/no-show:** 6 months, then PII fields (guestName, guestEmail, guestPhone) anonymized. **Waitlisted/bumped:** 30 days after status finalization. PIN hashes retained only as long as the reservation row exists. `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity (reservation = contract) + consent (marketing follow-up, if opted in) |
| **Deletion** | Retention job anonymizes completed reservations; `scripts/privacy-erase.ts` reaches reservations by email/phone/profile ID for individual erasure. Reservation PINs are deleted with the row — no separate retention. |

### 2.10 Waitlist

| Field | Detail |
|---|---|
| **What** | `WaitlistEntry`: name, phone, guestProfileId, partySize, quotedMinutes, notifiedAt |
| **Why** | Walk-in guest waitlist management |
| **Where** | `waitlist_entries` table (venue-scoped) |
| **How long** | 7 days after status → "seated"/"cancelled"/"no-show" `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity |
| **Deletion** | Retention job purges stale entries |

### 2.11 Event guests

| Field | Detail |
|---|---|
| **What** | `EventGuest`: name, partySize, guestProfileId, promoterId |
| **Why** | Guest list management for venue events |
| **Where** | `event_guests` table (child of VenueEvent, no own venueId) |
| **How long** | 30 days after event ends `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity + consent (joining a guest list) |
| **Deletion** | Cascade with event row deletion or retention job |

### 2.12 Admissions (plan 17 — door)

| Field | Detail |
|---|---|
| **What** | `Admission`: guestProfileId, partySize, admissionType, amountOwedCents, idCheck (JSON: may contain DOB, ID type, ID last 4 digits, staff notes), wristband (JSON), isReEntry, exitType |
| **Why** | Door admission tracking, capacity management, ID verification (age gate) |
| **Where** | `admissions` table (venue-scoped) |
| **How long** | 30 days after the business date `[OWNER REVIEW]` |
| **Lawful basis** | Legal obligation (age verification per liquor licensing) + legitimate interest (capacity/safety) |
| **Deletion** | Retention job removes expired rows; `scripts/privacy-erase.ts` reaches admissions by guest profile ID |

### 2.13 Door refusals

| Field | Detail |
|---|---|
| **What** | `DoorRefusal`: reason, description, partySize, refusedByStaffId, refusedByStaffName |
| **Why** | Record of denied entry — safety and regulatory |
| **Where** | `door_refusals` table (venue-scoped) |
| **How long** | 90 days `[OWNER REVIEW]` |
| **Lawful basis** | Legitimate interest (venue safety, regulatory compliance) |
| **Deletion** | Retention job |

### 2.14 Coat check tickets & claims

| Field | Detail |
|---|---|
| **What** | `CoatCheckTicket`: guestProfileId, itemCount, checkedInAt, claimedAt. `CoatCheckClaim`: claimType, description, reportedByStaffName |
| **Why** | Coat check service, lost-item claims |
| **Where** | Venue-scoped tables |
| **How long** | Tickets: 30 days after claim or season end. Claims: 90 days after resolution. `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity |
| **Deletion** | Retention job; cascade with guest profile |

---

## 3. Incidents (plan 17 — safety-sensitive, may contain health data)

### 3.1 Incidents

| Field | Detail |
|---|---|
| **What** | `Incident`: guestProfileId, involvedStaffIds (string array), narrative (free-text — may describe injuries, altercations, medical events), actionsTaken, witnesses (JSON: may include names, contact info), cctvReference, medicalChecklist (JSON: may include health details deemed sensitive under Law 25), staffInjuryDetails (JSON), reportedByStaffId, reportedByStaffName, policeInvolved, reportable, regulatoryDeadline, regulatoryAuthority, reportedToAuthorityAt, escalationLevel |
| **Why** | Safety incident documentation — regulatory compliance (liquor license, workplace safety), liability protection |
| **Where** | `incidents` table (venue-scoped); `incident_notes`, `incident_action_items` (child tables) |
| **How long** | **Standard incidents:** 3 years after resolution. **Reportable incidents** (police/regulatory): 7 years. **Incidents involving staff injury:** per Quebec CNESST retention. `[OWNER REVIEW]` |
| **Lawful basis** | Legal obligation + legitimate interest (safety, liability, regulatory) |
| **Deletion** | Retention job: 3/7 years per category; `scripts/privacy-erase.ts`: guest identity scrubbed from `guestProfileId` and `involvedStaffIds`, but narrative/actions core retained for the statutory period (the incident record itself is a regulatory obligation; erasure anonymizes the person, not the event) |
| **Special note** | `medicalChecklist` and `staffInjuryDetails` are sensitive personal information under Law 25 §12. Their retention follows the incident's statutory period; they are not stored separately from the incident record. |

### 3.2 Incident notes (child table — scoped through parent FK)

| Field | Detail |
|---|---|
| **What** | `IncidentNote`: note, authorStaffId, authorStaffName |
| **Why** | Staff-added notes on safety incidents |
| **Where** | `incident_notes` table (child of Incident, no own venueId — on `platformModels`) |
| **How long** | Same as parent Incident |
| **Lawful basis** | Legal obligation + legitimate interest |
| **Deletion** | Cascade with parent incident |

### 3.3 Incident action items

| Field | Detail |
|---|---|
| **What** | `IncidentActionItem`: description, assignedToStaffId, status |
| **Why** | Corrective action tracking |
| **Where** | `incident_action_items` table (venue-scoped) |
| **How long** | Same as parent Incident |
| **Lawful basis** | Legal obligation + legitimate interest |
| **Deletion** | Cascade with parent incident |

### 3.4 Incident templates

| Field | Detail |
|---|---|
| **What** | `IncidentTemplate`: label, type, severity, narrative/actions templates |
| **Why** | Quick-filing templates for staff |
| **Where** | `incident_templates` table (venue-scoped) |
| **How long** | Until venue deletes template or tenant offboarding |
| **Lawful basis** | Not PII — operational template, no personal data |
| **Deletion** | Cascade with venue |

---

## 4. Sales leads (marketing)

### 4.1 Leads

| Field | Detail |
|---|---|
| **What** | `Lead`: venueName, contactName, email, phone, city, source, dealValue, notes |
| **Why** | Pre-tenant sales pipeline — prospective venue operators |
| **Where** | `leads` table (platform, no venueId) |
| **How long** | **Closed/won:** until tenant created (then it's B2B, not marketing). **Closed/lost:** 12 months. **Stale (no activity 6 months):** purged. **Cold contacts (no consent):** not collected — the form requires submission. `[OWNER REVIEW]` |
| **Lawful basis** | Consent (submitted via /lead form) + legitimate interest (sales pipeline) |
| **Deletion** | Retention job; `scripts/privacy-erase.ts` by email |

### 4.2 Lead activity

| Field | Detail |
|---|---|
| **What** | `LeadActivity`: text (free-text touchpoint log) |
| **Why** | Sales pipeline tracking |
| **Where** | `lead_activities` table (child of Lead, no own venueId — on `platformModels`) |
| **How long** | Same as parent Lead |
| **Lawful basis** | Same as parent Lead |
| **Deletion** | Cascade with parent Lead |

---

## 5. Communications & notifications

### 5.1 Notification log (plan 25)

| Field | Detail |
|---|---|
| **What** | `NotificationLog`: recipient (email address or phone number), channel (email/sms/push), template, status, providerId, error, meta |
| **Why** | Idempotency check for notification delivery; audit trail |
| **Where** | `notification_logs` table (venue-scoped — on `platformModels`) |
| **How long** | **Sent:** 90 days, then recipient field truncated (hash only for dedup). **Failed:** 30 days. `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity (transactional notifications) + consent (marketing notifications) |
| **Deletion** | Retention job truncates `recipient` field; `meta` (JSON) may carry PII — truncated with the row |

### 5.2 Chat messages

| Field | Detail |
|---|---|
| **What** | `ChatMessage`: authorId, authorName, authorRole, body, channel |
| **Why** | Staff team chat |
| **Where** | `chat_messages` table (venue-scoped) |
| **How long** | 90 days `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity (staff communication tool) |
| **Deletion** | Retention job; cascade with venue deletion |

### 5.3 Broadcasts

| Field | Detail |
|---|---|
| **What** | `Broadcast`: message, sentBy |
| **Why** | Floor-wide staff announcements |
| **Where** | `broadcasts` table (venue-scoped) |
| **How long** | 30 days `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity |
| **Deletion** | Retention job; cascade with venue deletion |

---

## 6. Audit & observability

### 6.1 Audit entries

| Field | Detail |
|---|---|
| **What** | `AuditEntry`: actorStaffId, actorName, action, targetType, targetId, summary, metadata (JSON) |
| **Why** | Operational audit trail — who did what and when |
| **Where** | `audit_entries` table (venue-scoped) |
| **How long** | 12 months `[OWNER REVIEW]` |
| **Lawful basis** | Legal obligation + legitimate interest (fraud prevention, dispute resolution) |
| **Deletion** | Retention job; cascade with venue |

### 6.2 Admin actions (platform)

| Field | Detail |
|---|---|
| **What** | `AdminAction`: actorId, actorEmail, action, before/after (JSON snapshots), tenantId |
| **Why** | Platform-admin audit log — billing, provisioning, tenant management |
| **Where** | `admin_actions` table (platform, no venueId — on `platformModels`) |
| **How long** | 24 months `[OWNER REVIEW]` |
| **Lawful basis** | Legal obligation + legitimate interest |
| **Deletion** | Retention job |

### 6.3 Domain events

| Field | Detail |
|---|---|
| **What** | `DomainEvent`: venueId, type, payload (JSON — may contain PII for certain event types), createdAt |
| **Why** | Realtime event log for SSE fan-out |
| **Where** | `domain_events` table (venue-scoped) |
| **How long** | 7 days `[OWNER REVIEW]` |
| **Lawful basis** | Contract necessity |
| **Deletion** | Retention job |

### 6.4 Auth & request logs (plan 32)

| Field | Detail |
|---|---|
| **What** | Request logs from plan 32 middleware: IP, user agent, route, method, status, duration, requestId, userId (if authenticated), venueId |
| **Why** | Rate limiting, debugging, security incident investigation |
| **Where** | To be determined by plan 32 implementation — likely a `request_logs` table or structured log output |
| **How long** | 30 days `[OWNER REVIEW]` — aligned with plan 32's retention design. IP addresses are PII; truncated to /24 prefix after 7 days |
| **Lawful basis** | Legitimate interest (security, debugging) + legal obligation (incident response) |
| **Deletion** | Retention job |


### 6.5 Error tracker payloads (plan 32)

| Field | Detail |
|---|---|
| **What** | Error context from plan 32's error tracking: stack traces, request context (may include PII in error messages or request payloads) |
| **Why** | Error diagnosis and resolution |
| **Where** | Sentry/GlitchTip (external service — plan 32 documents the residency caveat) |
| **How long** | 90 days in Sentry; PII scrubbed at ingest (plan 32's apiError handler strips request bodies and auth headers before sending) `[OWNER REVIEW]` |
| **Lawful basis** | Legitimate interest |
| **Deletion** | Sentry retention policy; manual purge on request |

### 6.6 Backups (plan 33)

| Field | Detail |
|---|---|
| **What** | Full database backups — contain all PII in the system |
| **Why** | Disaster recovery |
| **Where** | Plan 33 backup storage (OVHcloud, Beauharnois QC — data-residency compliant) |
| **How long** | Per plan 33 retention: daily 7 days, weekly 4 weeks, monthly 12 months. Backups are append-only; individual-record deletion from a backup is not feasible — this is stated in the privacy policy and ToS. |
| **Lawful basis** | Legal obligation + legitimate interest |
| **Deletion** | Backup expiry per schedule; no per-record purge from backup files |

---

## 7. Financial & inventory (no PII — n/a for privacy)

These tables contain operational data without personal information:
`PlanConfig`, `TelemetryLink`, `MenuCategory`, `MenuItem`, `StockMovement` (item-level only, no staff PII), `SoldOutEvent`, `BottlePackage`, `PackageComponent`, `HappyHourRule`, `Promotion`, `NightlyRollup` (aggregated — no individual PII), `SavedReport`, `ReportRun`, `OrderItem`, `FeeLine`, `AdjustmentReason`, `TabAdjustment` (staffId but not PII — operational attribution), `VipTierBenefit`, `Supplier`, `SupplierItem`, `PurchaseOrder`, `Stocktake`, `EightySixEntry`, `ProfitTarget`, `EventCost`, `EventRunSheet`, `ChecklistTemplate`, `ChecklistRun`, `AutomationRule`, `AutomationExecution`, `AttentionItem`, `AttentionAcknowledgment`, `ActiveShowLock`, `VenueFloorState`, `OrderRemake`, `WalkoutRecord`, `EventTalent`, `BlackoutDate`, `OccupancyEvent`, `Zone`, `VenueTable`, `Venue`.

*Note:* Staff IDs on operational tables (`authorStaffId`, `resolvedByStaffId`, etc.) are operational attribution, not personal information by themselves. They are deleted when the staff User row is deleted (cascade) — the ID becomes unresolvable. Financial audit trail may still require the value (who voided this?), which the AuditEntry captures separately.

---

## 8. Analytics & anonymization boundary

`NightlyRollup` and analytics queries aggregate from orders, sessions, and
admissions. The retention job's anonymization of guest sessions and
reservations must not break analytics:

- **Revenue by zone / by item:** order counts + amounts — no PII.
- **Staff performance:** aggregated metrics (orders delivered, avg time) — staff identity is operational, not guest.
- **Guest visit count / lifetime spend:** these are profile-level aggregates that survive anonymization because they are counts of *what happened*, not *who did it* — the person is unlinked but the numbers remain in `GuestProfile` until the erasure request.
- **Category depletion:** units sold by category — no PII.
- **Time-series charts:** nightly revenue — no PII.

The pre/post anonymization check: run the same analytics query before and
after the retention job. Numbers must be identical. This is an integration
test case.

---

## 9. Cross-cutting notes

### 9.1 Data residency
All data lives in PostgreSQL on OVHcloud (Beauharnois, QC, Canada) —
see `docs/ARD.md` AD-15 and `docs/HOSTING.md`. Plan 33 backups stay in the
same region. Plan 32 error-tracker payloads go to Sentry/GlitchTip (US-hosted)
with PII scrubbed at ingest — see plan 32's residency caveat.

### 9.2 Children's data
The product is for 18+ venues (nightclubs). `Admission.idCheck` verifies
legal drinking age (`legalDrinkingAge` defaults to 18, configurable per
venue). `GuestProfile.dobYear` is collected but no guest under 18 should
exist — age-gated at door. The policy must state this.

### 9.3 Third-party processors
- **Stripe:** payment processing — card data never touches our servers.
- **Resend:** email delivery for notifications.
- **Sentry/GlitchTip:** error tracking — PII scrubbed at ingest (plan 32).
- **Better Auth:** authentication framework — session tokens.

### 9.4 Privacy officer
Designated in the privacy policy and `docs/legal/BREACH-REGISTER.md`.
Contact: the product owner (named in policy). If the team grows, a named
DPO or external privacy consultant is the next rung.

### 9.5 Consent withdrawal
Guest marketing consent is stored on `GuestProfile.marketingConsent`
(email/sms booleans). Staff can toggle in manager UI. Guest can request
withdrawal via privacy officer contact. No self-serve portal — request
volume does not justify it; the RUNBOOK procedure covers verification +
action within 30 days.

---

## 10. Retention summary table

| Data class | Retention | Trigger |
|---|---|---|
| Staff accounts (inactive) | 24 months since last login | Login date |
| Staff records (terminated) | 3 years (Quebec labour law) | Termination date |
| Guest profiles (inactive) | 24 months since last visit | `lastVisitAt` |
| Guest profiles (banned) | Ban expiry + 30 days | `bannedUntil` |
| Guest profiles (erasure request) | 30 days (Law 25 clock) | Request receipt |
| Guest sessions (closed) | 90 days → anonymized | Session close date |
| Guest sessions (open/pending) | Retained | N/A |
| Reservations (completed/cancelled) | 6 months → anonymized | Status change date |
| Reservations (waitlisted/bumped) | 30 days | Status change date |
| Waitlist entries | 7 days after final status | Status change |
| Event guests | 30 days after event end | Event end date |
| Admissions | 30 days after business date | `businessDate` |
| Door refusals | 90 days | `businessDate` |
| Coat check tickets | 30 days after claim/season end | Claim date |
| Coat check claims | 90 days after resolution | Resolution date |
| Incidents (standard) | 3 years after resolution | Resolution date |
| Incidents (reportable) | 7 years after resolution | Resolution date |
| Sales leads (closed/lost) | 12 months | Status change date |
| Sales leads (stale, 6 months idle) | Purged | Last activity date |
| Notification log recipients | 90 days → truncated | Send date |
| Chat messages | 90 days | Send date |
| Broadcasts | 30 days | Send date |
| Audit entries | 12 months | Creation date |
| Admin actions | 24 months | Creation date |
| Domain events | 7 days | Creation date |
| Auth/request logs (plan 32) | 30 days (IP truncated to /24 after 7) | Creation date |
| Error tracker (plan 32) | 90 days (PII scrubbed at ingest) | Ingestion date |
| Backups (plan 33) | Daily 7d, weekly 4w, monthly 12m | Backup date |
| Session tokens (expired) | Expiry + 7 days | Expiry date |
| Verification tokens (expired) | Expiry + 24 hours | Expiry date |
| Invitations (expired) | 90 days after expiry | Expiry date |
| Push subscriptions (expired) | 30 days after expiration | Rotation date |
| Certifications (expired) | Expiry + 1 year | Expiry date |

---

**All retention numbers are proposed defaults pending owner approval.**
Numbers marked `[OWNER REVIEW]` must be signed off before production
onboarding of a real venue.
