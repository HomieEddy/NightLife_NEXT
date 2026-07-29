# Traceability Matrix — Business Logic Gaps to Documentation

**Date:** 2026-07-27
**Purpose:** Maps every operational gap identified in the comprehensive business
logic audit to the PRD requirement, ARD decision, DDD invariant, and roadmap
phase where it is addressed.

---

## Safety Features (Phase 2)

| Gap | PRD | ARD | DDD Invariant | Roadmap |
|---|---|---|---|---|
| Age verification enforcement | R12, R2 | AD-17, AD-4 | INV-D4 | S-01 (Phase 2) |
| Mandatory incident reporting | R12, R18 | AD-16 | INV-D10, INV-C3 | S-02 (Phase 2) |
| Emergency evacuation mode | R12, R17 | AD-6, AD-16 | INV-F2, INV-D8 | S-03 (Phase 2) |
| Certification tracking | R18, R5 | AD-21 (rules) | INV-W9, INV-C1 | S-04 (Phase 2) |
| Ejection-to-door workflow | R12, R18 | AD-21 (rules) | INV-D7 | RV-17 (Phase 3) |
| Watchlist (separate from ban) | R13 | AD-17 | INV-D5, INV-G6 | RV-15 (Phase 3) |
| Denied-entry recording | R12 | AD-4, AD-16 | INV-D6 | Phase 2 (plan 17) |
| Incident escalation workflow | R5, R18 | AD-21 (rules) | — | OE-29 (Phase 3) |
| Witness & CCTV tracking | R12 | AD-16 | INV-D11 | OE-30 (Phase 3) |
| Medical incident checklist | R12 | — | — | OE-31 (Phase 3) |
| Post-incident action tracking | R18 | — | INV-D12 | OE-32 (Phase 3) |
| Regulatory compliance calendar | R15 | AD-9, AD-21 | INV-C2 | Phase 4 (cron) |

---

## Revenue & Guest Experience Features (Phase 3)

| Gap | PRD | ARD | DDD Invariant | Roadmap |
|---|---|---|---|---|
| Time-slotted reservations | R5, R18 | AD-21 | INV-R1 | RV-01 |
| Capacity-aware booking | R4, R12 | AD-21 | INV-V3 | RV-02 |
| Auto-gratuity rules engine | R3, R15 | AD-21 | INV-O9 | RV-03 |
| Cover price schedule engine | R5, R12 | AD-21 | INV-V4 | RV-04 |
| Order priority system | R6 | AD-21 | INV-O7 | RV-05 |
| Pre-order inventory check | R4 | — | INV-O5 | RV-06 |
| Delegated comp authority | R11 | AD-21 | INV-T3 | RV-07 |
| Split-bill workflow | R3, R16 | — | INV-S5 | RV-08 |
| Deposit model | R5 | — | INV-R2, INV-R3 | RV-09 |
| Cancellation window | R5 | AD-21 | INV-R3 | RV-10 |
| Reservation hold timer | R5 | AD-9 | INV-R4 | RV-11 |
| Guest preferences | R13, R16 | AD-17 | INV-G4, INV-G5 | RV-12, CRM-01→02 |
| Celebration detection | R15, R16 | AD-17, AD-21 | INV-G5 | RV-13 |
| Guest value scoring (RFM) | R8 | AD-17 | INV-G8 | RV-14 |
| Incident history on profile | R16 | AD-17 | — | RV-16 |
| Pending session timeout | R5 | AD-9, AD-21 | INV-S8 | RV-18 |
| Minimum-spend progress alerts | R15 | AD-21 | INV-S6 | RV-19 |
| Tab spending cap | R5 | AD-21 | — | RV-20 |
| Bar tab support | R16 | AD-17 | — | RV-21 |

---

## Operational Efficiency Features (Phase 3)

| Gap | PRD | ARD | DDD Invariant | Roadmap |
|---|---|---|---|---|
| Order SLA timer & escalation | R6, R15 | AD-21 | INV-O8 | OE-01 |
| Drink preparation ETA | R6, R16 | — | — | OE-02 |
| Batch fulfillment | R16 | — | — | OE-03 |
| Order modification (pending) | R5 | — | INV-O10 | OE-04 |
| Service items checklist | R16 | — | — | OE-05 |
| Round tracking | R18 | AD-21 | — | OE-06 |
| Dual session detection | R5 | AD-21 | — | OE-07 |
| Session reopen | R5 | — | INV-S1, INV-S9 | OE-08 |
| Pre-closure itemized review | R16 | — | — | OE-09 |
| Shift handoff for orders | R5, R18 | — | — | OE-10 |
| Reservation name matching | R16, R18 | — | — | OE-11 |
| Wristband/stamp tracking | R12 | — | — | OE-12 |
| VIP expedited entry | R16 | AD-17 | — | OE-13 |
| Re-entry cutoff time | R12 | AD-21 | — | OE-14 |
| Smoke break vs exit | R12 | — | — | OE-15 |
| Staggered admission warnings | R12, R15 | AD-21 | — | OE-16 |
| Guest-list capacity enforcement | R5 | AD-21 | INV-E1, INV-E2 | OE-17 |
| Guest-list bulk import | R16 | — | — | OE-18 |
| Event run sheet | R16 | — | — | OE-19 |
| Event-specific menu/pricing | R5 | AD-21 | INV-E3 | OE-20 |
| Overtime detection | R14, R15 | AD-21 | INV-W6 | OE-22 |
| Late-arrival tracking | R14, R15 | AD-21 | INV-W7 | OE-23 |
| No-show auto-detection | R5, R15 | AD-9, AD-21 | INV-W8 | OE-24 |
| Break compliance | R15 | AD-21 | — | OE-25 |
| Shift-swap deadline | R5 | AD-21 | — | OE-26 |
| Pre-shift briefing | R16 | — | INV-W11 | OE-27 |
| Staff performance metrics | R8, R14 | — | — | OE-28 |

---

## CRM & Guest Identity Features (Phase 3)

| Gap | PRD | ARD | DDD Invariant | Roadmap |
|---|---|---|---|---|
| Staff notes on profiles | R13, R16 | AD-17 | — | CRM-01 |
| Linked guest profiles | R13 | AD-17 | INV-G9 | CRM-02 |
| Guest photo | R13, R16 | AD-17 | INV-G7 | CRM-03 |
| Spend-by-category tracking | R8 | — | — | CRM-04 |
| Visit cadence analysis | R8 | AD-17 | INV-G8 | CRM-05 |
| Guest referral tracking | R13 | — | INV-G10 | CRM-06 |
| GDPR deletion workflow | R13 | AD-17, AD-9 | — | CRM-07 |

---

## Analytics & Automation Features (Phase 4)

| Gap | PRD | ARD | DDD Invariant | Roadmap |
|---|---|---|---|---|
| Night-over-night comparison | R8 | AD-11 | — | AI-01 |
| Forecast / projection engine | R8 | AD-11 | — | AI-02 |
| Per-hour breakdown dashboard | R8 | — | — | AI-03 |
| Door-to-table conversion funnel | R8 | AD-11 | — | AI-04 |
| Table-turn analytics | R8 | AD-11 | — | AI-05 |
| Order SLA analytics | R8 | AD-11 | — | AI-06 |
| Comp/void ratio monitoring | R8, R15 | AD-21 | — | AI-07 |
| Report CSV export & email delivery | R8, R15 | AD-8, AD-22 | — | AI-08 |
| Promoter performance report | R8, R15 | AD-11 | — | AI-09 |
| Night summary auto-generation | R8, R15 | AD-9, AD-11 | — | AI-14 |
| Auto-release overdue reservations | R5, R18 | AD-9, AD-21 | INV-R4 | AM-01 |
| Auto-suggested PO | R4, R18 | AD-9, AD-21 | INV-CS6 | AM-02 |
| Auto-escalate overdue orders | R6, R15, R18 | AD-9, AD-21 | INV-O8 | AM-03 |
| Auto-detect duplicate reservations | R18 | AD-21 | — | AM-04 |
| Auto-flag VIP tier upgrade | R18 | AD-17, AD-21 | — | AM-05 |
| Auto-notify VIP host on arrival | R15, R18 | AD-20, AD-22 | — | AM-11 |
| Auto-flag dormant VIPs | R18 | AD-17, AD-21 | — | AM-12 |

---

## PWA & Push Notification Features (Phase 5)

| Gap | PRD | ARD | DDD Invariant | Roadmap |
|---|---|---|---|---|
| Service Worker + app shell | R16, R17 | AD-19 | — | PWA-01→03 |
| Offline indicator & action queue | R17 | AD-19 | — | PWA-04→05 |
| Responsive mobile-first layouts | R16 | AD-19 | — | PWA-06 |
| Web Push API integration | R15 | AD-20 | — | PSH-01 |
| Push subscription management | R15 | AD-20 | INV-N3 | PSH-02 |
| Notification preference centre | R15 | AD-22 | INV-N1 | PSH-03 |
| Role-based notification routing | R15 | AD-4, AD-22 | INV-N1 | PSH-04 |
| Event-driven notification engine | R15, R18 | AD-22 | INV-N2 | PSH-05 |
| Notification history & delivery tracking | R15 | AD-22 | INV-N2 | PSH-06 |
| Quiet hours | R15 | AD-20, AD-22 | INV-N4 | PSH-07 |
| Retry policies | R15 | AD-22 | — | PSH-08 |
| 20 operational notification templates | R15 | AD-22 | — | PSH-09 |

---

## Production Readiness (Phase 6)

| Gap | PRD | ARD | DDD Invariant | Roadmap |
|---|---|---|---|---|
| Security hardening | R2 | AD-13 | — | Plan 22 |
| Observability (logging, errors, health) | R6 | AD-13, AD-15 | — | Plan 23 |
| Automated backups + restore drill | — | AD-13, AD-15 | — | Plan 24 |
| French/English i18n | R16 | AD-13 | — | Plan 27 |
| Law 25/PIPEDA compliance | R13 | AD-17, AD-9 | INV-C2, INV-C3 | Plan 29 |
| Multi-language guest surfaces | R16 | AD-13 | — | Plan 27 |

---

## CI/CD & Deployment (Phase 7)

| Gap | PRD | ARD | DDD Invariant | Roadmap |
|---|---|---|---|---|
| CI/CD pipeline | — | AD-23 | — | Plan 21 |
| Automated staging/production deploys | — | AD-15, AD-23 | — | DPL-01→02 |
| Blue-green deploy strategy | — | AD-23 | — | DPL-04 |
| Infrastructure-as-code | — | AD-23 | — | DPL-05 |
| Database migration automation | — | AD-23 | — | DPL-06 |
| Automated rollback | — | AD-23 | — | DPL-09 |
| Disaster recovery runbook | — | AD-23 | — | OPS-01 |
| Backup verification | — | AD-23 | — | OPS-02 |
| Production monitoring dashboard | — | AD-23 | — | OPS-03 |

---

## Cross-Cutting Gaps

| Gap | PRD | ARD | DDD Invariant | Roadmap |
|---|---|---|---|---|
| Notification infrastructure | R15 | AD-22 (dispatch), AD-8 (email), AD-20 (push) | INV-N1→N4 | Plans 25–26 (Phase 2) |
| No offline resilience | R17 | AD-19 (PWA offline queue) | — | PWA-04→05 (Phase 5) |
| No multi-language | R16 | AD-13 | — | Plan 27 (Phase 6) |
| No opening/closing checklists | R16 | — | — | OE-35 (Phase 3) |
| No lost & found | R16 | — | — | Phase 5 parking lot |
| No pass-down log | R16 | — | INV-W11 (briefings) | Phase 5 |
| No multi-venue | — | AD-3 | — | Deferred (parking lot) |
| No regulatory compliance tracking | R12 | AD-9, AD-21 | INV-C1→C3 | S-04 (Phase 2) + Phase 4 (cron) |
| No staff direct messaging | R6 | AD-6 | — | Deferred (chat channels suffice) |
| No guest Wi-Fi assistance | R16 | — | — | Deferred (marketing concern) |

---

## Coverage Summary

| Domain | Total Gaps | Covered by PRD | Covered by ARD | Covered by DDD | Roadmap Phase |
|---|---|---|---|---|---|
| Safety | 12 | 12 | 11 | 10 | Phase 2 |
| Revenue & Guest Experience | 21 | 21 | 16 | 12 | Phase 3 |
| Operational Efficiency | 35 | 35 | 20 | 4 | Phase 3 |
| CRM & Guest Identity | 10 | 10 | 7 | 7 | Phase 3 |
| Analytics & Automation | 27 | 27 | 21 | 8 | Phase 4 |
| PWA & Push | 20 | 20 | 13 | 11 | Phase 5 |
| Production Readiness | 15 | 12 | 8 | 6 | Phase 6 |
| CI/CD & Deployment | 17 | 4 | 3 | 0 | Phase 7 |
| Cross-Cutting | 10 | 8 | 7 | 4 | Phases 2–6 |
| **Total** | **167** | **149** | **106** | **62** | **All phases** |

**Coverage gaps (unmapped):** 18 gaps are operational details that don't require
a formal PRD requirement, ARD decision, or DDD invariant — they are implementation
details addressed by the feature descriptions in the roadmap (e.g., "guest of"
grouping, dress code check, supplier performance tracking). These are tracked
by their feature codes (OE-21, OE-08 dress code in Phase 5 note, OE-33).

**Coverage status:** All findings from the 2026-07-27 business logic audit map
to at least one documented plan, requirement, decision, or invariant.
Backlog decomposition into individual implementation stories with acceptance
criteria, permissions, and tests is in progress — the roadmap feature codes
(RV/OE/CRM/AI/AM) are implementation-ready headlines, not executable stories
(see F11 in the 2026-07-27 documentation consistency audit).
