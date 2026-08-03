# Breach Register — NightLifeNext

**Purpose:** Law 25 §3.8 / PIPEDA mandatory internal record of every
confidentiality incident involving personal information.

**Privacy officer:** [TBD — designate before go-live]

**Last updated:** 2026-08-03

---

## Template — one entry per incident

Entries are numbered. Leave no gaps. Update the same entry as the
investigation progresses — do not create a new row for follow-up findings.

| # | Date discovered | Date contained | Data classes affected | Individuals affected | Risk level | CAI notified? | Affected notified? | Root cause | Post-mortem link | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|

**Status:** `investigating` → `contained` → `notified` → `closed`

---

## Current entries

_No incidents on record. This register is maintained from the first day of
operations with real personal data._

---

## Procedure

See `docs/RUNBOOK.md` §incident-response for the full containment →
assessment → notification → remediation → post-mortem workflow.

### Risk levels

| Level | Definition | Notification required |
|---|---|---|
| **Low** | Internal access control error, no exfiltration, data not sensitive (e.g. internal-only IP exposure). | Register only. |
| **Medium** | Limited exfiltration possible, or sensitive data involved (contact details, session data). | Register + CAI notification. Affected individuals if exfiltration confirmed. |
| **High** | Confirmed exfiltration of sensitive data (financial, health, identity documents, staff home addresses). | Register + CAI + all affected individuals within 72 hours. |
| **Critical** | Large-scale breach (>100 individuals) or breach involving protected categories (minors, health data, criminal records). | Register + CAI + all affected individuals within 72 hours. Escalate to legal counsel immediately. |

### CAI thresholds (Law 25)

- **Mandatory CAI notification:** any breach posing a "risk of serious injury"
  (identity theft, financial loss, reputational damage, discrimination risk).
- **"Serious injury"** is assessed per individual, not per incident — a breach
  of 5,000 email addresses may be low risk per person; a breach of 5 staff
  home addresses may be high risk.
- **72-hour clock** starts when you *confirm* the breach poses a risk of
  serious injury — not from discovery of the incident.
- **Register entry** is required regardless of risk level. The register is
  the CAI's first ask in an audit.

### DSAR erasures log

Record each DSAR erasure executed via `scripts/privacy-erase.ts`:

| Date | Search criteria | Operator | Guest profiles | Sessions anonymized | Reservations anonymized | Leads deleted | Other |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

This supplements the breach register — DSARs are not breaches, but the CAI
may request evidence of compliance. The operator column identifies who ran
the erase script; the script's dry-run output is the primary audit trail.
