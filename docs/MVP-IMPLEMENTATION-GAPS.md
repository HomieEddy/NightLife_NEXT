# MVP Implementation Gaps — Launch Blockers & Must-Haves

> **Date:** 2026-07-29
> **Source:** Business Logic Audit (`docs/BUSINESS-LOGIC-AUDIT.md`)
> **Scope:** Only items required to reach a launchable MVP for a VIP bottle-service nightclub
> **Philosophy:** Ship what a venue needs to survive opening night and the first month.
> Defer what can be handled manually, on paper, or verbally until post-launch.

---

## Selection Criteria

An item is MVP if it meets **any** of:
1. **Regulatory/safety blocker** — operating without it creates legal liability
2. **Operational show-stopper** — staff literally can't run the night without it
3. **Revenue-critical for VIP bottle service** — the core business model breaks without it
4. **Data integrity** — missing it corrupts the audit trail or financial records

Everything else — nice-to-have, competitive differentiator, optimization — is post-MVP.

---

## MVP GAPS BY DOMAIN

### 1. VENUE MANAGEMENT

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **VM-02** | Zone capacity | Fire code compliance. A VIP room at legal limit is invisible without per-zone tracking. Regulatory liability on day one. | Add `capacity: number \| null` to `Zone` type. Add `canAdmitToZone(zoneId, partySize)` check. Wire into door admission flow. |
| **VM-04** | Table hold/out-of-service | Staff needs "hold for VIP" and "broken booth" daily. Without it, tables are held verbally and inevitably double-booked. | Add `'held' \| 'out-of-service'` to `TableStatus`. Add `holdReason`, `heldBy`, `heldUntil` to table. Add `holdTable()`, `releaseHold()`, `markOutOfService()`, `returnToService()` methods. |
| **VM-05** | Opening/closing checklists | Safety, consistency, and staff accountability. Inspectors ask for these. | New `ChecklistTemplate` + `ChecklistRun` types. Default opening checklist (10 items) and closing checklist (10 items). CRUD + run/complete methods. |

### 2. MENU & INVENTORY

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **MI-01** | Allergen filter for guests | Liability. A guest with a severe allergy has no self-service way to find safe bottles. | Add `listItemsByAllergenExclusion(exclude[])` service method. Allergen data already exists on items. |

### 3. ORDERING & TABS

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **OT-02** | Rush/priority override | VIP bottle service core flow. Manager/host must be able to rush a VIP table's order. | Add `isRushed: boolean`, `rushedBy: string` to Order. Add `rushOrder(orderId, staffId)` method. |
| **OT-05** | Re-fire/remake | "This bottle is corked" happens nightly. Cancel+reorder is wrong (double charges, lost tracking). | Add `OrderRemake` type linking old → new order. Add `remakeOrder(orderId, reason)` — voids old, creates new at 'accepted', no double-charge. |
| **OT-06** | Last-call order restrictions | Legal requirement. After last call, continued service violates liquor license terms. | Add `lastCallPolicy` to venue settings. Add validation in `submitOrder()` checking last-call state. Track `lastCallOrderPlaced` on session. |
| **OT-08** | Comped round workflow | Daily VIP operation. "This round is on the house" must be one action, not 6 individual comps. | Add `compEntireOrder(orderId, reason, compedBy)` that comps all items in one audit entry. |
| **OT-09** | Walkout tracking | Revenue protection. Untracked walkouts mean repeat offenders come back. | Add `WalkoutRecord` type. Add `reportWalkout(sessionId, description)` — closes session, files incident, flags profile. Add `'walkout'` to settlement methods. |

### 4. GUEST SESSIONS

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **GS-03** | VIP host assignment | Core bottle-service workflow. Each VIP table must have an assigned host — this IS the service model. | Add `assignedHostId`, `assignedHostName` to `GuestSession`. Add `assignHost()`, `unassignHost()`, `listSessionsByHost()`. |
| **GS-05** | Auto-close abandoned sessions | Tables appear occupied but are empty, blocking real guests. Happens every night. | Add `abandonedSessionThresholdMinutes` to venue settings. Add `detectAbandonedSessions()` and `autoCloseSession()`. |
| **GS-06** | Session notes | "Table 5 is celebrating engagement — bring sparklers with the Moët." Without notes, every host-to-runner handoff is verbal. | Add `SessionNote` type (id, sessionId, note, createdBy, createdAt). Add `addSessionNote()`, `listSessionNotes()`. |
| **GS-07** | Force-close for end of night | Can't close venue if guest refuses to leave. Manager needs override. | Add `forceCloseSession(sessionId, reason, closedBy)` — cancels open orders, closes session, audit entry. Manager-only. |

### 5. GUEST CRM

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **CRM-04** | Real-time spend velocity | VIP bottle service revolves around knowing who's spending big tonight for live treatment decisions. | Add `getGuestSpendTonight(profileId)` → { totalSpent, orderCount }. Add `getTopSpendersTonight(limit)`. |
| **CRM-05** | VIP tier benefits | Tiers exist but mean nothing operationally. Staff doesn't know what "VIP" gets vs "Host-List." | Add `VipTierBenefit` type (tier, benefit description, category). CRUD methods. Seed default benefits per tier. |

### 6. DOOR & OCCUPANCY

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **DO-02** | Dress code refusal tracking | Happens 10+ times nightly. Without tracking, no data on how many turned away, patterns, or bias detection. | Add `DoorRefusal` type (reason, description, partySize, refusedBy, timestamp). Add `recordRefusal()`, `listRefusals()`. |
| **DO-06** | Per-zone capacity | Companion to VM-02. Occupancy must be computable per zone, not just venue-wide. Fire code requirement. | Add `getZoneOccupancy(zoneId)`, `canAdmitToZone(zoneId, partySize)`, `getOccupancyByZone()`. Derive from sessions on tables in zone. |
| **DO-08** | Group admission | A VIP limo of 12 people admitted one-by-one creates a 10-minute bottleneck. Critical for VIP first impression. | Add `groupAdmissionId` to Admission. Add `admitGroup(admissions[])` for batch admission. |
| **DO-10** | Coat check lost item | Coat check exists. Lost-ticket and lost-item scenarios happen weekly and have no workflow. | Add `CoatCheckClaim` type (claimType: normal/lost-ticket/lost-item, verification, resolution). Add `reportLostTicket()`, `reportLostItem()`, `resolveClaim()`. |

### 7. SAFETY & INCIDENTS

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **SI-01** | Incident location | "Where did this happen?" is the first question on any report. Without zone linkage, incident pattern analysis is impossible. | Add `zoneId` and `locationDescription` to `Incident`. Add `getIncidentsByZone(dateRange)`. |
| **SI-06** | Staff injury tracking | Worker's compensation requires documented injury reports. Legal liability without it. | Add `'staff-injury'` to `IncidentType`. Add `StaffInjuryDetails` (staffId, injuryType, treatment, workersCompFiled). |
| **SI-08** | Quick-file templates | Filing an incident during a 1,500-person Saturday at 2 AM is slow. Pre-filled templates for common types make it viable. | Add `IncidentTemplate` type. Seed 5 default templates (intoxicated patron, minor altercation, medical-fainting, property damage, refused entry). Add `fileFromTemplate()`. |

### 8. RESERVATIONS

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **RV-06** | Blackout dates | Without blackout dates, guests book for NYE when the venue is sold out, or for a closed date. Manual rejection is unprofessional. | Add `BlackoutDate` type (date, reason, zoneId optional). Add `createBlackoutDate()`, `listBlackoutDates()`. Check in `createReservation()` and `createPublicReservation()`. |
| **RV-07** | Late arrival grace period | Auto-release (AM-01) exists but no configurable grace period. Tables released too early = angry VIPs. | Add `lateArrivalGracePeriodMinutes` to venue settings (default: 30). Add `arrivalDeadline` computation. Feed into AM-01 auto-release. |
| **RV-10** | Bump/upgrade workflow | Walk-in whale wants the reserved table. This happens every weekend. Without a system flow, it's chaos + angry original booker. | Add `bumpReservation(reservationId, reason, alternativeTableId)`. Add `bumpedFrom`, `bumpReason` to Reservation. Audit entry + optional guest notification. |

### 9. EVENTS

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **EV-01** | Artist/talent management | Any venue with live entertainment needs to track who's performing, when, and what they need. Verbal coordination fails at scale. | Add `EventTalent` type (name, role, set times, arrival, rider, green room, status). CRUD methods + `markTalentArrived()`, `markTalentPerforming()`. |
| **EV-03** | Event cancellation | Can't formally cancel an event. No cancellation state, no guestlist notification flow. | Add `'cancelled'` to `EventStatus`. Add `cancellationReason`, `cancelledAt` fields. Add `cancelEvent()` method. |

### 10. WORKFORCE

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **WF-05** | Staff table assignment | "You have tables 1-5 tonight" is the most basic service assignment. Currently verbal only. | Add `StaffTableAssignment` type (staffId, tableIds[], zoneId, shiftId). Add `assignTables()`, `getTableAssignment()`, `getAssignedStaff(tableId)`. |
| **WF-06** | Break compliance | Quebec labor law: breaks are mandatory after continuous work periods. No tracking = violation. | Add `requiredBreakAfterMinutes` and `breakDurationMinutes` to venue settings. Add `getBreakComplianceStatus(staffId)`, `listStaffNeedingBreak()`. |
| **WF-10** | Shift handoff | Night shift replaces day shift — no structured handoff. Information loss causes operational failures. | Add `ShiftHandoff` type (open incidents, VIP notes, inventory alerts, special instructions). Add `generateHandoff()`, `acknowledgeHandoff()`. |

### 11. PROMOTER SYSTEM

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **PR-02** | Guestlist quota | Promoters add unlimited guests. Without quotas, guestlists explode past capacity. | Add `guestlistQuota` to promoter profile or per-event allocation. Add `getQuotaUsage(promoterId, eventId)`. Validate on `addEventGuest()`. |

### 12. REALTIME / PULSE

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **RT-01** | Attention acknowledgment | Staff sees 15 attention items and can't mark "I'm handling this." Items pile up, nothing gets done. | Add `AttentionAcknowledgment` type. Add `acknowledgeAttentionItem()`, `snoozeAttentionItem()`. Filter acknowledged/snoozed from pulse feed. |
| **RT-08** | Revenue pace indicator | "Are we on track for the night?" — the most common manager question. Currently requires full analytics page. | Add `getRevenuePace()` → { current, lastWeekSameTime, pacePercent, projected }. Lightweight method for pulse dashboard. |

### 13. ANALYTICS

No MVP gaps. The analytics domain is 78% complete and the existing depth is sufficient for launch. Post-launch focus: YoY comparison, custom KPIs, anomaly detection.

### 14. AUTOMATION

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **AU-01** | Auto-close abandoned sessions | Tables blocked by dead sessions every night. Must auto-detect and close. | New automation rule: `auto-close-abandoned-sessions`. Config: threshold minutes (default 60). Scans for approved sessions with 0 orders past threshold. |

### 15. NOTIFICATIONS

| # | Gap | Why MVP | Implementation |
|---|---|---|---|
| **NT-02** | Guest ban → door staff | Door staff must know immediately when a ban is issued. Currently no notification. | Wire `door:ban` domain event → push notification to all security role on shift. |
| **NT-06** | Capacity at 90% → door staff | Door needs to know when to slow admissions. Critical for legal compliance. | Wire capacity-warning attention item → push notification to security role. |
| **NT-08** | New incident → security lead + manager | Incidents filed with no notification = no response. | Wire incident creation → push to security shift lead + manager. |
| **NT-13** | Shift starting in 1 hour → staff | Staff arrives late because they forgot. Most common scheduling problem. | New scheduled job: query shifts starting in 60 min, push reminder. |

### 16. PLATFORM ADMIN

No MVP gaps. The existing tenant provisioning, plan gating, and lead CRM are sufficient for launch. Post-launch focus: multi-venue management, tenant health scoring, white-label.

---

## IMPLEMENTATION PRIORITY ORDER

Ordered by: regulatory risk → operational impact → revenue impact → data integrity.

### Sprint 1 — Safety & Compliance (Regulatory Blockers)

| # | Ref | Item | Effort |
|---|---|---|---|
| 1 | VM-02 + DO-06 | Zone capacity + per-zone occupancy | M |
| 2 | OT-06 | Last-call order restrictions | S |
| 3 | WF-06 | Break compliance tracking | S |
| 4 | SI-06 | Staff injury incident type | S |
| 5 | VM-05 | Opening/closing checklists | L |

**Exit criteria:** Fire code per-zone, liquor license last-call, labor law breaks, worker comp injuries, inspector-friendly checklists.

### Sprint 2 — VIP Bottle Service Core (Revenue-Critical)

| # | Ref | Item | Effort |
|---|---|---|---|
| 6 | GS-03 | VIP host assignment to sessions | S |
| 7 | WF-05 | Staff table assignment | S |
| 8 | OT-02 | Rush/priority override | S |
| 9 | OT-08 | Comped round workflow | S |
| 10 | OT-05 | Re-fire/remake | M |
| 11 | CRM-04 | Real-time guest spend velocity | S |
| 12 | CRM-05 | VIP tier benefit definitions | S |
| 13 | RT-08 | Revenue pace indicator | S |
| 14 | DO-08 | Group admission (VIP arrivals) | S |

**Exit criteria:** Host owns a table, staff assigned to tables, VIP orders can be rushed/remade/comped, live spend tracking, tier benefits defined.

### Sprint 3 — Nightly Operations (Show-Stoppers)

| # | Ref | Item | Effort |
|---|---|---|---|
| 15 | VM-04 | Table hold/out-of-service | S |
| 16 | GS-05 | Auto-close abandoned sessions | S |
| 17 | AU-01 | Auto-close abandoned (automation rule) | S |
| 18 | GS-06 | Session notes | S |
| 19 | GS-07 | Force-close for end of night | S |
| 20 | OT-09 | Walkout tracking | M |
| 21 | DO-02 | Dress code refusal tracking | S |
| 22 | DO-10 | Coat check lost item handling | S |
| 23 | RT-01 | Attention acknowledgment/snooze | M |
| 24 | WF-10 | Shift handoff briefing | M |

**Exit criteria:** Tables can be held/blocked, dead sessions auto-close, staff can annotate sessions, end-of-night force-close works, walkouts tracked, pulse items actionable.

### Sprint 4 — Booking & Events (Revenue Support)

| # | Ref | Item | Effort |
|---|---|---|---|
| 25 | RV-06 | Blackout dates | S |
| 26 | RV-07 | Late arrival grace period | S |
| 27 | RV-10 | Bump/upgrade workflow | M |
| 28 | EV-01 | Artist/talent management | M |
| 29 | EV-03 | Event cancellation status | S |
| 30 | PR-02 | Promoter guestlist quota | S |

**Exit criteria:** Reservations respect blackout dates and grace periods, VIP tables can be bumped with audit trail, events have talent tracking and can be cancelled.

### Sprint 5 — Safety & Notifications (Operational Polish)

| # | Ref | Item | Effort |
|---|---|---|---|
| 31 | SI-01 | Incident location tracking | S |
| 32 | SI-08 | Incident quick-file templates | M |
| 33 | MI-01 | Allergen filter for guests | S |
| 34 | NT-02 | Ban → door staff notification | S |
| 35 | NT-06 | Capacity 90% → door staff notification | S |
| 36 | NT-08 | Incident → security + manager notification | S |
| 37 | NT-13 | Shift reminder (1 hour before) | S |

**Exit criteria:** Incidents have location data and templates, allergens filterable, critical events push-notify the right staff.

---

## EFFORT KEY

| Size | Estimate | Scope |
|---|---|---|
| **S** | 1-2 hours | Type addition + 1-3 service methods + mock data |
| **M** | 3-5 hours | New type system + 4-8 service methods + mock data + core logic |
| **L** | 6-10 hours | New feature sub-domain (types + service + mock data + templates) |

**Total estimated effort:** ~70-90 hours across 5 sprints

---

## WHAT WE'RE EXPLICITLY DEFERRING

These are in the full audit but NOT MVP. They can be handled manually, on paper, or verbally for the first few months:

| Category | Deferred Items | Manual Workaround |
|---|---|---|
| **Venue** | Multi-floor hierarchy, zone sections, maintenance tracking, early closure workflow | Verbal coordination, paper maintenance log |
| **Menu** | Recipes/BOM (product decision), bar stations, tonight-only pricing, supplier disputes, recalls, waste rate analysis | Per-product-focus; manual pricing; paper disputes |
| **Ordering** | Order modification, batching/rounds, kitchen/bar routing, order hold/delay, spending cap enforcement | Verbal modifications, verbal routing |
| **Sessions** | Party groups, away state, session lock, re-entry linking, feedback/rating | Verbal party coordination |
| **CRM** | Communication history, complaints, birthday detection, loyalty, groups, un-merge, do-not-contact | Manual CRM notes |
| **Door** | Queue/line management, wristband types, multi-entrance, private zone access, reconciliation, ID scanner, ratio management | Paper queue, verbal wristband policy |
| **Incidents** | Chain linking, first responder dispatch, evidence/photos, near-miss, de-escalation, follow-up reminders, legal hold, insurance | Follow-up via notes; photos on personal phones |
| **Reservations** | Waitlist conversion, overbooking, guest self-service, recurring, multi-table, partial arrival, date transfer | Manual waitlist management, phone modifications |
| **Events** | Series/recurring, multi-promoter, security plans, pre-event checklists, post-event debriefs, extensions | Paper checklists, verbal coordination |
| **Workforce** | Role delegation, overtime, training records, disciplinary, availability preferences, on-call, emergency callout, auto-schedule, multi-venue staff | Paper records, verbal delegation |
| **Promoter** | Contracts, approval workflow, territories, tiers, attribution disputes, external model, offboarding, accountability | Paper contracts, verbal agreements |
| **Pulse** | Zone routing, DJ channel, guest announcements, escalation chains, floor activity log | Verbal coordination |
| **Analytics** | YoY comparison, weather, custom KPIs, anomaly detection, satisfaction, labor ratio | Spreadsheet analysis |
| **Automation** | Birthday detection, break reminder, incident escalation, cert expiry, revenue pace, zone close suggestion | Manual checks |
| **Notifications** | Most triggers beyond the 4 MVP ones | Verbal/radio communication |
| **Platform** | Multi-venue, tenant health, customer success, usage analytics, white-label | Manual account management |
| **Cross-cutting** | Offline mode, French i18n, lost & found | Paper fallback, bilingual staff |

---

## SUCCESS METRIC

**MVP is launchable when:**
1. Per-zone capacity enforced at the door (fire code)
2. Last-call stops ordering (liquor license)
3. Break compliance tracked (labor law)
4. VIP host assigned to sessions (core service model)
5. Staff assigned to specific tables (core service model)
6. Opening/closing checklists operational (inspector readiness)
7. Orders can be rushed, remade, and comped as a round (nightly operations)
8. Walkouts tracked with incident linkage (revenue protection)
9. Dead sessions auto-close (floor accuracy)
10. Critical events push-notify the right staff (operational awareness)

When all 10 conditions are met, the venue can open its doors on a Friday night and operate through to close without system-level gaps forcing manual workarounds for core workflows.
