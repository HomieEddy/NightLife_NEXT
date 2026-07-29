# Business Logic & Feature Gap Audit — NightLife_NEXT

> **Date:** 2026-07-29
> **Scope:** Operational completeness audit for a high-volume VIP bottle-service nightclub platform
> **Excludes:** Payment processing, POS, invoicing, accounting
> **Product focus:** VIP bottle service (recipes/cocktails/pour-cost deferred)

---

## Executive Summary

**Overall Platform Score: 61%**

The platform has an unusually strong technical foundation — type system, audit trail,
state machines, service architecture, and analytics depth are well-designed. The gap
is not in what was built, but in what was left implicit. Many workflows exist at the
service layer but lack notification triggers, role distinctions, and edge-case handling
that turn a feature into a reliable operational tool.

| Domain | Score | Status |
|---|---|---|
| Analytics & Reporting | 78% | Most complete |
| Ordering & Tabs | 71% | Solid core |
| Automation Engine | 70% | Good rule engine |
| Menu & Inventory | 68% | Strong ledger |
| Reservations | 65% | Solid lifecycle |
| Guest Sessions & Help | 64% | Good basics |
| Venue Management | 62% | Missing floors/checklists |
| Realtime / Floor Pulse | 62% | Good attention items |
| Guest Identity & CRM | 60% | Rich profiles, no loyalty |
| Workforce & Scheduling | 58% | Good time clock |
| Door & Occupancy | 58% | Strong admission tracking |
| Platform Admin | 55% | Basic multi-tenant |
| Safety & Incidents | 55% | Good foundation |
| Events | 52% | Basic lifecycle |
| Promoter System | 48% | Attribution works, gaps wide |
| Notifications | 45% | Infrastructure ready, triggers missing |

---

## 1. VENUE MANAGEMENT — 62%

### What Works
- Rich venue settings (timezone, night window, SLA thresholds, capacity, fees, tips, age verification, coat check, auto-gratuity)
- Zone CRUD with referential integrity (can't delete zone with tables)
- Interactive floor map with drag-and-drop table positioning
- QR token generation per table with signed URLs

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| VM-01 | **No multi-floor concept.** Zones are flat — no floor/level hierarchy. A three-story venue can't model "Floor 1: Main Bar" vs "Floor 2: VIP Lounge" with per-floor capacity and staffing. | Can't enforce per-floor fire code limits |
| VM-02 | **No zone capacity.** `legalCapacity` is venue-wide only. A VIP room at fire-code limit while the main floor has space is invisible to the system. | Fire code violation risk |
| VM-03 | **No table merge/split.** Tables are fixed-seat immutable. Physical tables pushed together for large parties or split for smaller ones can't be modeled. | Inaccurate capacity representation |
| VM-04 | **No table hold/out-of-service states.** Only `open | occupied | reserved | closed`. No "hold VIP-03 for the owner's friend" or "block T-12 — booth seat broken." | Lost reservations, seated at broken tables |
| VM-05 | **No opening/closing checklists.** No formal pre-open or post-close checklist workflow. Inventory checklist exists but doesn't cover lights, sound, ice, security sweep, bathroom check. | Safety gaps, inconsistent operations |
| VM-06 | **No maintenance/facility tracking.** Broken equipment, plumbing, HVAC — no system to log, assign, track resolution. Only option is filing an incident (wrong severity model). | Equipment failures cascade untracked |
| VM-07 | **No early closure workflow.** Power outage, police order, weather — no "early closure" flow that stops admissions, triggers last call, and logs the reason. | Chaotic closures, no audit trail |
| VM-08 | **No zone open/close.** Zone flooded, fight, private event takes over — no zone-level disable with reason. | Double-bookings, access control failures |
| VM-09 | **No venue sections within zones.** VIP zone has "main VIP", "balcony VIP", "bottle corner" — no sub-zone for host assignment. | Can't assign staff to sub-areas |

### Edge Cases Not Handled
- Venue forced to close early (power outage, police, weather)
- Zone temporarily closed mid-night (flooding, fight, private takeover)
- Table physically damaged during service
- Venue reconfiguration between events on the same night
- Fire marshal arrives for surprise capacity audit — no compliance report mode

---

## 2. MENU & INVENTORY — 68%

### What Works
- Append-only stock movement ledger with reason codes
- Par levels per day of week with reorder points
- Supplier management with performance metrics
- Stocktake with dual count and variance tracking
- 86 board with automatic reinstatement automation (AM-08)
- Happy hour rules with time/day/category scoping
- Bottle packages with component-level inventory tracking
- Waste recording with reason codes
- Purchase order lifecycle (draft → submitted → partially-received → received)
- Pre/post-service inventory checklists
- Profit targets with threshold alerts

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| MI-01 | **No allergen/dietary filter for guests.** Items have allergen fields but guests can't filter the menu by allergen. | Allergy-related liability risk |
| MI-02 | **No menu availability rules beyond happy hour.** Kitchen closes at 1 AM, food items should auto-86. No time-based or dependency-based auto-availability. | Guests order unavailable items |
| MI-03 | **No tonight-only pricing.** No "tonight only" pricing outside of happy hour rules. Special event pricing for a single night requires workarounds. | Pricing inflexibility |
| MI-04 | **No supplier delivery discrepancy handling.** PO receiving doesn't model partial/wrong deliveries with dispute tracking. | Disputes untracked, inventory inaccurate |
| MI-05 | **No backup/secondary supplier priority.** No primary/secondary supplier ranking. When primary can't deliver, no system to suggest alternatives. | Stockout when primary fails |
| MI-06 | **No breakage/waste rate analysis.** Waste is recorded but not analyzed against expected rates. 8% breakage vs 2% standard should trigger alerts. | Theft/waste invisible |
| MI-07 | **No item recall workflow.** Supplier/health authority recalls an item — no workflow to pull from service and track affected inventory. | Regulatory risk, guest safety |
| MI-08 | **No menu versioning for events.** `EventMenuOverride` exists as a type but operational enforcement in the ordering flow needs explicit support. | Event pricing not enforced |
| MI-09 | **No bar station concept.** 86 board applies globally. Bar 1 out of Patron while Bar 2 has 6 bottles — all bars see "86'd." | Staff checks wrong bar for stock |

### Edge Cases Not Handled
- Supplier delivers wrong items or short shipment with no dispute workflow
- Stocktake reveals theft (variance far exceeds expected waste) — no theft investigation flag
- Item recalled by health authority — no recall workflow
- Ice machine breaks — no infrastructure dependency tracking
- Backup supplier needed urgently — no priority-based suggestion

---

## 3. ORDERING & TAB MANAGEMENT — 71%

### What Works
- Clean order flow state machine (pending → accepted → preparing → ready → delivered)
- Claim/release prevents runner duplication
- Tab adjustments append-only with mandatory reason codes
- Void returns inventory; comp/discount do not (correct)
- Reversal tracking for adjustments
- Session balance derived from orders + adjustments
- Shift cashout with variance detection
- Service refusal blocks new orders
- Round counting for responsible service
- Dual session detection
- Gift/send-a-bottle workflow
- Priority scoring on orders

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| OT-01 | **No order modification after submission.** "Make that a double" or "add a Red Bull" requires cancel-and-reorder. | Guest/staff friction, inventory confusion |
| OT-02 | **No rush/priority override.** No manual "rush this order" for VIP tables or manager override beyond computed priority. | VIP service quality gap |
| OT-03 | **No order batching/round concept.** 6 drinks for one table should arrive together. No explicit round grouping. | Drinks arrive piecemeal to VIP tables |
| OT-04 | **No kitchen/bar routing.** Orders go to "staff" generically. No routing to kitchen display vs bar vs bottle service team. | Wrong staff sees wrong orders |
| OT-05 | **No re-fire/remake workflow.** "This drink is wrong" requires void + new order. Should be single action tracking reason without double-charge. | Guest waits longer, tracking lost |
| OT-06 | **No last-call order restrictions.** `startLastCall()` broadcasts but doesn't restrict ordering. Guests keep ordering after last call. | Service past legal hours |
| OT-07 | **No spending cap enforcement.** Caps are advisory — no block when exceeded. | Budget overruns for hosted events |
| OT-08 | **No comped-round workflow.** "This round is on the house" requires individual per-item comps. No bulk comp action. | Slow comp process during busy service |
| OT-09 | **No walkout/dine-and-dash tracking.** No workflow for guest who leaves without closing tab. | Revenue loss, repeat offenders untracked |
| OT-10 | **No misdelivery tracking.** No record when order delivered to wrong table. | Service quality invisible |
| OT-11 | **No order hold/delay.** "Don't make this until 12:30" — no scheduled or held orders. | No timed bottle service |
| OT-12 | **No minimum-spend proactive warning.** Shortfall computed post-hoc, not warned proactively. | Surprise minimum charges |

### Edge Cases Not Handled
- Guest disputes order ("I didn't order this") — no dispute flow
- Staff delivers to wrong table — no correction workflow
- Item sells out during preparation — no mid-prep handling
- Power outage mid-service — orders in "preparing" have no timeout
- Guest leaves without closing tab — no walkout workflow
- Multiple orders from same table collide at bar — no consolidation

---

## 4. GUEST SESSIONS & HELP — 64%

### What Works
- Clean session state machine with validation (can't close with in-flight orders)
- Ejection as integrated workflow (refuse service + ban + incident)
- Session transfer with audit trail
- Tab merge (takes higher minimum spend)
- Bar tabs for non-table guests
- Split bill assignments
- Promoter attribution carried from reservation
- Spending caps and pending session timeouts
- Service refusal auto-files incident

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| GS-01 | **No group/party session management.** Party of 12, 4 scan QR — each gets own session. No "party" concept grouping sessions for coordinated service. | Fragmented service for VIP tables |
| GS-02 | **No session pause/away state.** Guest steps out to smoke — table appears occupied but is empty. No "away" state. | Tables blocked unnecessarily |
| GS-03 | **No VIP concierge/host assignment.** High-value sessions should have a dedicated staff member. No host-to-session assignment. | VIP service quality gap |
| GS-04 | **No session feedback/rating.** No way for guests to rate experience on close. | CRM blind spot |
| GS-05 | **No auto-close for abandoned sessions.** Approved at 10 PM, no orders by 11 PM — sits open forever. | Tables blocked, floor map inaccurate |
| GS-06 | **No session notes for staff.** "Table 5 celebrating engagement" — no freeform notes visible to assigned staff. | Staff misses VIP treatment opportunities |
| GS-07 | **No force-close override for end of night.** Guest refuses to leave — session blocks closure. | Closing delayed |
| GS-08 | **No session lock (lost/stolen device).** Can't prevent ordering from lost device. | Unauthorized orders |
| GS-09 | **No re-entry session linking.** Guest exits for smoke break and returns — no link between re-entry and existing session. | Orphaned sessions |

### Edge Cases Not Handled
- Guest's phone dies mid-session — no fallback ordering
- Guest loses phone — session open on lost device
- Minor at adult's table tries to order alcohol — no per-session age gate
- Large party split bill 6 ways — edge cases around partial settlements
- Guest refuses to leave at closing — no force-close
- Guest claims overcharge — no dispute-to-adjustment pipeline

---

## 5. GUEST IDENTITY & CRM — 60%

### What Works
- Opt-in identity (privacy by design)
- RFM-based value scoring (recomputed nightly)
- Temporal bans (bannedUntil)
- Watchlist separate from ban (alert, don't block)
- Profile deduplication with ranked matching
- Profile merge with rollup
- GDPR/Law 25 compliant deletion
- Marketing consent with source tracking
- Staff notes with attribution
- Linked profiles ("always comes with")
- Visit cadence analysis (dormancy, streak)
- Photo for VIP/banned recognition

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| CRM-01 | **No guest communication history.** No record of messages sent. Can't see "we already texted this guest tonight." | Duplicate communications, guest annoyance |
| CRM-02 | **No guest complaint/feedback tracking.** Separate from incidents — "music too loud" is CRM, not security. | Problems go unreported |
| CRM-03 | **No birthday/anniversary auto-detection.** DOB year and celebration dates stored but no automation to flag birthdays tonight. | Missed VIP treatment opportunities |
| CRM-04 | **No real-time guest spend velocity.** Value score is nightly. No "this guest spent $2K tonight" for live VIP decisions. | Can't identify tonight's high-spenders |
| CRM-05 | **No VIP tier benefits definition.** Tiers exist (none/regular/vip/host-list) but no system defines what each tier gets. | Tiers are labels without operational meaning |
| CRM-06 | **No guest group/company profiles.** "Goldman Sachs Friday crew" or "Birthday Club" — no group entity distinct from individual profiles. | No recurring group recognition |
| CRM-07 | **No loyalty program mechanics.** No points, stamps, visit milestones, or reward redemption. | No retention incentive beyond recognition |
| CRM-08 | **No do-not-contact flag.** Marketing consent covers email/SMS but no blanket "don't contact this person." | Risk of contacting sensitive profiles |
| CRM-09 | **No un-merge capability.** Merged profiles can't be split back when merge was wrong (two different people). | Permanently corrupted profile data |
| CRM-10 | **No expired ban arrival notification.** Previously banned guest arrives after ban expires — security unaware. | Unaware of risk patterns |

### Edge Cases Not Handled
- Guest banned at one venue appears at another in same group — no cross-venue ban
- Celebrity requires anonymous booking — no incognito mode
- Merged profile was wrong — no un-merge
- Guest provides fake contact info — no validation/bounce tracking
- Minor identified during session — no age-related session termination

---

## 6. DOOR & OCCUPANCY — 58%

### What Works
- Append-only occupancy ledger (delta-based, forensically sound)
- Age verification as hard block (no override)
- Capacity override always audited
- Re-entry linking with no double-billing
- Exit type tracking (final vs smoke break)
- Cover price rules (time/event/day-based)
- Evacuation workflow with headcount
- Wristband assignment
- Ban check at admission with override audit
- Coat check lifecycle
- Waitlist with quoted times and overdue alerting

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| DO-01 | **No queue/line management.** No model for "300 people in line outside." No queue position, estimated wait, VIP skip. | Door experience unmanaged |
| DO-02 | **No dress code refusal tracking.** No "refused: dress code" tracking. | Refusal data lost, bias risk |
| DO-03 | **No guestlist-to-admission integration.** Door staff cross-reference events and guestlists manually. No "I'm on the list" → lookup → check-in flow. | Slow door, frustrated VIP guests |
| DO-04 | **No wristband type system.** Color/number assigned but no type management (21+, VIP, All-Access, Event). No wristband inventory. | Wristband meaning unclear |
| DO-05 | **No multi-entrance tracking.** Large venues have main door, VIP entrance, artist entrance. Each needs its own admission flow. | Incomplete occupancy tracking |
| DO-06 | **No per-zone capacity.** No zone-level occupancy computation from sessions/admissions. | Can't enforce per-room fire limits |
| DO-07 | **No private event zone access list.** "Rooftop is private tonight" — no per-zone access restriction. | Unauthorized access to private areas |
| DO-08 | **No group admission workflow.** Limo of 15 admitted one-by-one. No batch admission. | Slow VIP group processing |
| DO-09 | **No occupancy reconciliation.** Ledger says 450, physical count says 420. No reconciliation workflow. | Occupancy accuracy degrades |
| DO-10 | **No coat check lost item handling.** No workflow for lost ticket or lost item from coat check. | Guest complaints, liability |
| DO-11 | **No ID scanner integration point.** Manual ID checks only. No architecture for hardware integration. | Slow processing, fake ID detection limited |
| DO-12 | **No ratio management.** No gender tracking or ratio monitoring at the door. | Can't enforce venue ratio policies |

### Edge Cases Not Handled
- Someone collapses in line outside (pre-admission) — no pre-admission incident
- Fake ID detected — no confiscation tracking
- Fire marshal surprise audit — no compliance report
- Guest claims they paid cover with no record — no proof-of-admission
- Mass arrival (bus/limo of 30) — no group workflow
- Occupancy sensor vs ledger discrepancy — no reconciliation

---

## 7. SAFETY & INCIDENTS — 55%

### What Works
- Immutable narrative (can't edit after filing)
- Regulatory reporting with deadline and authority tracking
- Medical checklist (ambulance, paramedics, transport)
- Post-incident action items with assignment
- Escalation levels 0-3
- CCTV reference fields
- Witness tracking

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| SI-01 | **No incident location tracking.** "Near Bar 2" or "men's restroom floor 2" — no zone linkage for pattern analysis. | Can't identify hotspot zones |
| SI-02 | **No incident chain/linking.** Fight → ejection → police = 3 unlinked incidents. Should be one chain. | Context lost across related events |
| SI-03 | **No first responder dispatch.** No assignment/dispatch workflow. Report filed after the fact. | No dispatch tracking |
| SI-04 | **No evidence/photo attachment.** Written narratives only. No photos of injuries, damage, or scene. | Weak position in disputes/legal |
| SI-05 | **No near-miss tracking.** Industry safety practice includes logging almost-incidents. | Prevention opportunities missed |
| SI-06 | **No staff injury tracking.** Bouncer injured during altercation — no worker's comp incident type. | Liability exposure |
| SI-07 | **No de-escalation log.** Successful de-escalation not tracked for training/recognition. | Only failures documented |
| SI-08 | **No incident quick-file templates.** Filing mid-rush is slow. No pre-filled templates for common types. | Incidents not filed in real-time |
| SI-09 | **No incident follow-up reminders.** Action items exist but no automation to remind assignees. | Items go stale |
| SI-10 | **No legal hold.** No data preservation flag when lawsuit filed. | Evidence may be altered/deleted |
| SI-11 | **No insurance claim linkage.** No field for claim numbers or insurer notification. | Claims process manual |
| SI-12 | **No staff misconduct subtype.** Guest complains about staff behavior — no specific incident type. | Staff issues tracked as generic "other" |

### Edge Cases Not Handled
- Incident involves a minor — no mandatory additional reporting
- Off-duty police involved — no special handling flag
- Incident in shared space (lobby, parking lot) — jurisdiction unclear
- Witness refuses information — no anonymous witness
- Legal hold on incident data — no preservation flag
- Guest complaint about staff (not a security incident) — wrong category

---

## 8. RESERVATIONS — 65%

### What Works
- Atomic table-status flip with reservation transitions
- Seating conflict detection
- Capacity-aware booking (RV-02)
- Public reservation embed with real-time availability
- PIN lifecycle (minted on confirm, cleared on seat)
- Promoter attribution carried to session
- Deposit and cancellation term tracking
- Hold-until timer
- Celebration type flags
- Multiple channels (embed, direct, walk-in, promoter)

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| RV-01 | **No waitlist-to-reservation conversion.** Waitlist and reservations are separate systems. No automatic offer when table opens. | Manual coordination required |
| RV-02 | **No overbooking strategy.** No overbooking ratio management or contingency when all overbooked parties show. | Empty tables from no-shows, or no plan when all arrive |
| RV-03 | **No guest self-service modification.** Guests can book publicly but can't change or cancel their own reservations. | Staff handles every change |
| RV-04 | **No recurring/standing reservations.** "Every Friday, VIP-01, party of 8" requires weekly manual rebooks. | Friction for highest-value guests |
| RV-05 | **No multi-table group reservations.** Party of 30 needs 3 tables — each booked separately, no linkage. | Fragmented large-party management |
| RV-06 | **No blackout dates.** Can't block reservations on specific dates (NYE sold out, private event). | Bookings accepted for unavailable dates |
| RV-07 | **No late arrival grace period logic.** Auto-release exists (AM-01) but no configurable grace period with guest notification. | Tables released too early or too late |
| RV-08 | **No partial arrival handling.** Booked for 6, only 2 show — no partial-arrival affecting minimum spend. | Minimum spend disputes |
| RV-09 | **No reservation transfer between dates.** "Move to Saturday" requires cancel + rebook, losing history. | Booking history lost |
| RV-10 | **No bump/upgrade workflow.** Walk-in VIP needs the reserved table — no system-supported bump with notification. | Ad-hoc bumping, angry guests |
| RV-11 | **No confirmation reminder automation (day-before).** Reminders only 1-3 hours before. No day-before "Reply Y to confirm." | Higher no-show rate |

### Edge Cases Not Handled
- Guest arrives 2 hours late, table given away — no late-arrival flow
- Two reservations staggered, first party won't leave — no forced turn
- Guest gives different name than booking — no alias matching
- Walk-in VIP demands reserved table — no bump workflow
- Event changes reservation requirements mid-day

---

## 9. EVENTS — 52%

### What Works
- Event lifecycle (draft → published → live → ended)
- Event cost tracking (talent, marketing, production, other) with P&L
- Run sheet timeline entries
- Event menu overrides
- Guestlist with party-size check-in
- "Guest of" group attribution
- Public event pages
- Event analytics

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| EV-01 | **No artist/talent management.** Events have costs but no talent entity — no artist, rider, arrival time, set times, green room. | Artist coordination is verbal-only |
| EV-02 | **No run sheet staff assignment.** Entries exist but aren't assigned. "Who confirms DJ setup?" is undefined. | Accountability gap |
| EV-03 | **No event cancellation status.** No 'cancelled' state, no cancellation workflow, no guestlist/reservation notification. | Can't formally cancel events |
| EV-04 | **No event series/recurring.** "Latin Night every Thursday" created individually. No template-to-instance pattern. | Repetitive manual work |
| EV-05 | **No multi-promoter per event.** Single guestlist — no per-promoter segmentation, quotas, or per-event-per-promoter performance. | Can't manage promoter competition |
| EV-06 | **No event security plan.** Large events need security deployment plans with positions and assignments. | Security improvised |
| EV-07 | **No pre-event checklist.** Run sheet is a timeline, not a preparation checklist with confirmation tracking. | Missed setup items |
| EV-08 | **No post-event debrief.** No structured review (what worked, financial recap, incident summary). | Learnings are informal |
| EV-09 | **No event extension workflow.** Event runs past scheduled end — no formal extension with updated pricing/menu. | Pricing/staffing confusion |
| EV-10 | **No event-specific capacity management.** Events have capacity but no ticket-count tracking against that limit. | Overcrowded events |

### Edge Cases Not Handled
- Headliner cancels day-of — no emergency event modification
- Event runs past scheduled end — no extension workflow
- Two events same night, different zones — conflict management
- Guest claims "+1" but guestlist entry maxed party count
- Promoter oversells guestlist allocation
- Celebrity surprise appearance — no unscheduled talent

---

## 10. WORKFORCE & SCHEDULING — 58%

### What Works
- Append-only time entries with supersede chain
- Zone coverage rules with Pulse alerts
- Shift swap workflow with approval
- Time-off requests with approval
- Pre-shift briefings
- Certification tracking with expiry
- Tips: configurable pool rules
- Commission system with multiple basis types
- 3-channel team chat
- Missing clock-out detection in Pulse

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| WF-01 | **No role hierarchy/delegation.** Manager steps out — no "acting manager" or delegation. | Authority gap during absence |
| WF-02 | **No overtime tracking/alerts.** No awareness of labor law thresholds (8 hrs/day, 40 hrs/week). | Labor law violations, cost overruns |
| WF-03 | **No training records.** Certifications track compliance but not internal training (menu, safety, harassment). | Training not tracked |
| WF-04 | **No disciplinary records.** Warnings, write-ups, suspensions not tracked. | No HR documentation trail |
| WF-05 | **No staff table assignment.** Shift assigns zone but not specific tables. "You have tables 1-5" is verbal. | Unclear table ownership |
| WF-06 | **No break compliance.** No tracking of required breaks after X hours. | Labor law violations |
| WF-07 | **No on-call/standby shifts.** No shift type for "be available if needed." | Can't track standby availability |
| WF-08 | **No staff availability preferences.** "I prefer not to work Sundays" — no availability input. | Schedule conflicts |
| WF-09 | **No emergency all-hands broadcast.** Can't call in all off-duty staff. | Understaffing during emergencies |
| WF-10 | **No shift handoff briefing.** No structured handoff of current state between shifts. | Information loss at transition |
| WF-11 | **No auto-schedule generation.** Coverage rules exist but don't propose schedules. | Manual scheduling only |
| WF-12 | **No barback role distinction.** Barback with bartender permissions is a liability risk. | Permission overexposure |
| WF-13 | **No tip-out to support staff.** No mechanism for tipping out non-service roles (barback, kitchen). | Unfair tip distribution |
| WF-14 | **No multi-venue staff profile.** Staff at multiple venues need separate accounts. | Administrative overhead |

### Edge Cases Not Handled
- Staff no-show — no automatic coverage-finding
- Staff injured during shift — no replacement workflow
- Staff caught stealing — no immediate access revocation
- Emergency requires all-hands — no mass callout
- Staff phones break — no shared-device mode
- Two staff dispute a tip — no resolution mechanism

---

## 11. PROMOTER SYSTEM — 48%

### What Works
- Full attribution chain (promoter → reservation → session → revenue)
- Commission system with multiple basis types
- Promoter performance analytics
- Per-promoter reservation views
- Guestlist management per event

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| PR-01 | **No promoter contracts/agreements.** No terms, guaranteed minimums, bonus thresholds, quota definitions. | Terms are verbal, disputes likely |
| PR-02 | **No guestlist quota management.** "You get 50 names" — no maximum, no tracking. | Promoters add unlimited guests |
| PR-03 | **No approval workflow for high-value bookings.** Any promoter can book any table regardless of value. | Revenue risk from unauthorized bookings |
| PR-04 | **No promoter territory/exclusivity.** Two promoters book same VIP section — no conflict detection. | Double-bookings, disputes |
| PR-05 | **No promoter performance tiers.** No tier system affecting commission rates or privileges. | No incentive structure |
| PR-06 | **No guest-promoter attribution disputes.** Two promoters claim same guest — no resolution workflow. | Commission disputes |
| PR-07 | **No external promoter model.** Promoters must be staff members. Independent promoters who work with multiple venues can't be modeled. | Legal and operational friction |
| PR-08 | **No promoter offboarding.** No graceful departure: reassign reservations, notify guests, settle commission. | Orphaned bookings on departure |
| PR-09 | **No promoter guest accountability.** No tracking of incidents caused by a promoter's guests. | Problematic promoters undetected |
| PR-10 | **No promoter settlement tracking.** Statements approved but no record of actual payout. | Payout disputes |

### Edge Cases Not Handled
- Promoter's guest causes major incident — no accountability
- Promoter promises already-booked table — conflict at reservation level only
- Promoter submits fake guestlist entries — no verification
- Promoter leaves mid-contract — no offboarding process
- Multiple promoters claim same guest — no dispute resolution

---

## 12. REALTIME & FLOOR PULSE — 62%

### What Works
- 12 attention item types covering orders, help, capacity, inventory, staffing
- Warning vs critical severity
- SSE-backed real-time via Postgres LISTEN/NOTIFY
- Broadcast cross-posts to all chat channels
- Show queue with single-slot lock (bottle presentation)
- Last call state management
- Domain events as audit trail

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| RT-01 | **No attention item acknowledgment/snooze.** Staff can't say "I'm on it" or "remind me in 10." | Items pile up without feedback |
| RT-02 | **No attention zone/station routing.** All items for a role appear globally. Runner for VIP sees main floor items. | Information overload |
| RT-03 | **No DJ/entertainment channel.** Three chat channels — no channel for DJ/sound/lighting. | Entertainment coordination via text |
| RT-04 | **No guest-facing announcements.** Broadcasts to staff only. No "VIP area now open" to guest devices. | Missed engagement opportunities |
| RT-05 | **No escalation chains for all attention types.** Only order-overdue escalates. Others just sit. | Critical items go unaddressed |
| RT-06 | **No shift handoff state snapshot.** No structured handoff document from current realtime state. | Incoming shift flies blind |
| RT-07 | **No floor activity log.** No human-readable activity feed distinct from technical event stream. | No operational narrative |
| RT-08 | **No live revenue pace indicator.** No "we're 30% behind last Saturday at this time" in pulse. | Revenue pacing invisible |

---

## 13. ANALYTICS & REPORTING — 78%

### What Works
- Night comparison with same-weekday-last-week deltas
- Pace-based revenue forecasting
- Per-hour breakdown with peak detection
- Door-to-table funnel with drop-off rates
- Table turn analytics
- Order SLA with percentile analysis (p50/p95/p99)
- Comp/void ratio monitoring with threshold flagging
- Promoter performance reporting
- Incident pattern analysis by zone/hour/day
- Guest retention metrics
- Bottle service utilization
- Capacity utilization with 15-minute sampling
- Auto-generated night summary with suggestions
- Scheduled report distribution via email
- CSV export

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| AN-01 | **No year-over-year comparison.** Only week-over-week. No seasonal planning support. | Can't identify seasonal trends |
| AN-02 | **No weather correlation.** Revenue is weather-dependent. No external data integration. | Can't explain revenue dips |
| AN-03 | **No custom KPI/goal tracking.** Can't set "hit $50K Saturday" and track live. | No target-driven operations |
| AN-04 | **No report sharing across venues.** Single-venue only. No ownership group rollup. | Multi-venue operators blind |
| AN-05 | **No anomaly detection.** No automated "this is unusual" flagging beyond thresholds. | Proactive insights missing |
| AN-06 | **No guest satisfaction metrics.** No NPS, survey, or feedback aggregation. | Customer satisfaction unmeasured |
| AN-07 | **No labor-to-revenue ratio.** Staff cost vs revenue — critical ops metric absent. | Can't optimize staffing costs |

---

## 14. AUTOMATION ENGINE — 70%

### What Works
- 13 configurable rules across reservations, orders, inventory, VIP, events, reports
- Per-venue enable/disable with configurable parameters
- Execution logging with affected entities
- Diverse coverage

### Missing Automations

| # | Gap | Impact |
|---|---|---|
| AU-01 | **No auto-close abandoned sessions.** Session approved but inactive 60+ min — stays open forever. | Tables blocked |
| AU-02 | **No auto-waitlist promotion.** Table opens but waitlist not auto-notified. | Manual coordination |
| AU-03 | **No auto-birthday/celebration detection.** DOB exists but no automation to flag tonight's birthdays. | Missed VIP moments |
| AU-04 | **No auto-break reminder.** 4+ hours without break — no reminder. | Labor compliance risk |
| AU-05 | **No auto-incident escalation.** High-severity incidents don't auto-escalate to manager. | Critical incidents sit unaddressed |
| AU-06 | **No auto-certification expiry alert.** Certs track expiry but no X-days-before alert. | Compliance lapse |
| AU-07 | **No auto-revenue-pace alert.** "30% behind last Saturday" — no live pacing automation. | Revenue shortfall invisible |
| AU-08 | **No auto-zone-close suggestion.** Empty zone for 30 min — no suggestion to consolidate. | Wasted staffing |

---

## 15. NOTIFICATIONS — 45%

### What Works
- Multi-channel dispatch (email, SMS, push)
- Per-user per-event opt-in/out preferences
- Idempotency prevents duplicates
- Dead subscription cleanup
- Daily SMS cap as cost guard
- Driver abstraction (log for dev, real for prod)
- SSE real-time streams

### Missing Notification Triggers

| # | Trigger | Recipient |
|---|---|---|
| NT-01 | Reservation no-show | Promoter who booked it |
| NT-02 | Guest ban issued | All door staff on shift |
| NT-03 | Certification expiring in 30 days | Staff member + manager |
| NT-04 | Shift swap approved | Both staff members |
| NT-05 | Stock below par | Bar manager |
| NT-06 | Capacity at 90% | All door staff |
| NT-07 | VIP guest departed | Assigned host |
| NT-08 | New incident filed | Security lead + manager |
| NT-09 | Event status change | All event staff |
| NT-10 | Commission statement approved | Promoter |
| NT-11 | Maintenance issue reported | Operations manager |
| NT-12 | Cashout variance exceeds threshold | Manager |
| NT-13 | Shift starting in 1 hour | Staff member |
| NT-14 | All sessions closed for table | Cleaning staff |
| NT-15 | Guest complaint filed | Manager + assigned staff |
| NT-16 | Previously banned guest arrived (ban expired) | Security on shift |

---

## 16. PLATFORM ADMIN — 55%

### What Works
- Lead CRM pipeline (new → contacted → demo → negotiating → won/lost)
- Tenant provisioning with onboarding wizard
- 13-feature gating per plan
- Plan configuration management
- Telemetry links
- Audit trail at platform level

### Missing Business Logic

| # | Gap | Impact |
|---|---|---|
| PA-01 | **No multi-venue management.** Nightclub groups can't see aggregate data, share staff, or manage a portfolio. | Each venue is an island |
| PA-02 | **No tenant health scoring.** No "tenant hasn't logged in for 2 weeks" or "usage declining." | Churn invisible |
| PA-03 | **No customer success workflow.** No post-onboarding health checks or QBR scheduling. | Reactive customer management |
| PA-04 | **No feature usage analytics per tenant.** Which features does each tenant use? | Product decisions uninformed |
| PA-05 | **No white-label configuration.** No venue branding on guest-facing surfaces — logo, colors, custom domain. | Generic guest experience |

---

## CROSS-CUTTING GAPS

### Missing Operational Workflows

| # | Workflow | Description |
|---|---|---|
| W-01 | **Opening Procedures** | Checklist: venue inspection, bar setup, sound/lighting, security briefing, cash drawer, staff assignments |
| W-02 | **Closing Procedures** | Checklist: last call → tab settlement → departure → cash count → incidents → cleaning → sweep → lockup |
| W-03 | **Shift Handoff** | Structured briefing: open situations, VIP notes, incident status, inventory alerts |
| W-04 | **Lost & Found** | Item logged → storage → claim attempts → disposition after retention |
| W-05 | **Venue Maintenance** | Issue → priority → dispatch → resolve → verify |
| W-06 | **Early/Emergency Closure** | Stop admissions → broadcast → last call → force close → report |
| W-07 | **Private Event Takeover** | Zone blocked → access restricted → event → teardown → return to normal |
| W-08 | **Staff Emergency** | Injury/illness → replacement → incident → coverage |
| W-09 | **Guest Walkout** | Suspected → tab flagged → description broadcast → incident → profile flagged |
| W-10 | **Noise/Neighbor Complaint** | Complaint → sound check → adjustment → log → follow-up |

### Missing Role Distinctions

| Current | Missing | Impact |
|---|---|---|
| Manager | **Owner** (read-only financial oversight) | Owners can't monitor without full access |
| Manager | **General Manager** vs **Floor Manager** | Can't delegate nightly ops |
| Manager | **Operations Manager** (facilities, vendors) | Facility issues untracked |
| Security | **Door Staff** vs **Floor Security** | Different permissions needed |
| Host | **VIP Host** (dedicated to high-value tables) | No differentiated VIP service |
| Bartender | **Barback** (no order authority) | Permission overexposure |
| None | **DJ/Entertainment** | Entertainment coordination verbal |
| None | **Cleaning/Porters** | No task assignment to cleaning |

### Offline/Degraded Mode — CRITICAL GAP

Zero offline capability. When Wi-Fi dies at 1 AM Saturday:
- No service worker for basic operation
- No local queue that syncs on reconnect
- No printed fallback for menu/QR codes
- No manual admission tracking
- No offline order taking

### French Language — COMPLIANCE GAP

Montreal venue. Law 101 (Charter of the French Language) requires French for
consumer-facing content. Guest-facing menu, help requests, and session flow
appear English-only. Regulatory compliance risk in Quebec.

---

## RISK REGISTER

### Critical

| # | Risk | Consequence |
|---|---|---|
| R-01 | No offline/degraded mode | Complete operational failure when connectivity drops at peak |
| R-02 | No per-zone/floor capacity | Fire code violation risk — rooms can exceed limits invisibly |
| R-03 | No opening/closing checklists | Safety and regulatory gaps, inconsistent operations |
| R-04 | No French language support | Law 101 non-compliance, fines, license risk in Quebec |

### High

| # | Risk | Consequence |
|---|---|---|
| R-05 | No lost & found | Liability for valuables, guest complaints |
| R-06 | No shift handoff | Information loss at shift change |
| R-07 | No queue/line management | Unmanaged door experience |
| R-08 | No guest feedback mechanism | Satisfaction unmeasured |
| R-09 | No artist/talent management | Event operations partially improvised |
| R-10 | No maintenance tracking | Equipment failures cascade |
| R-11 | No order modification | Forced cancel-reorder creates friction |
| R-12 | No external promoter model | Legal/operational friction |

### Medium

| # | Risk | Consequence |
|---|---|---|
| R-13 | No multi-venue management | Groups can't operate efficiently |
| R-14 | No dress code refusal tracking | Data loss, bias risk |
| R-15 | No staff disciplinary records | HR blind spots |
| R-16 | No recurring reservations | VIP friction |
| R-17 | No auto-close abandoned sessions | Tables appear occupied but empty |
| R-18 | No incident location tracking | Can't identify hotspot zones |
| R-19 | No VIP tier benefit definitions | Tiers are meaningless labels |
| R-20 | No group session management | Fragmented VIP service |
| R-21 | No incident evidence attachment | Weak legal position |
| R-22 | No last-call order restrictions | Service past legal hours |

### Low

| # | Risk | Consequence |
|---|---|---|
| R-23 | No weather correlation | Can't explain revenue patterns |
| R-24 | No parking/valet integration | Minor coordination gap |
| R-25 | No DJ communication channel | Verbal coordination |
| R-26 | No post-event debrief | Informal learning |
| R-27 | No guest rating on close | Minor CRM gap |
| R-28 | No ID scanner architecture | Manual checks work but slower |
