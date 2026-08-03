# Privacy Policy

**NightLifeNext — Effective: [DATE]**
**Last updated: 2026-08-03**
**Status: [DRAFT — legal review required before publishing]**

This privacy policy describes how NightLifeNext ("we", "our", "us") collects,
uses, discloses, and retains personal information through our nightclub
operations platform. It complies with Quebec's Act respecting the protection of
personal information in the private sector (Law 25) and the federal Personal
Information Protection and Electronic Documents Act (PIPEDA).

---

## 1. Who we are

NightLifeNext is a SaaS platform for nightclub operations — table management,
ordering, reservations, floor coordination, and guest CRM — provided to venue
operators (our customers). This policy covers the platform itself. Each venue
that uses the platform is a separate data controller for the guest and staff
data it collects through the platform; we act as a data processor for that
information.

**Privacy officer:** [NAME] — [EMAIL]  
Reach this contact for any privacy question, access request, or complaint.

---

## 2. What we collect and why

We collect the minimum information needed to operate the platform. We do not
use advertising trackers, third-party analytics scripts, or non-essential
cookies.

### 2.1 Information you provide

| Category | Examples | Purpose |
|---|---|---|
| **Venue staff accounts** | Name, email, phone, role | Authentication, authorization, scheduling, payroll support |
| **Guest profiles** | Name, email, phone, birth year, preferences, photo (optional) | Reservation management, table service, VIP programs, safety |
| **Reservations** | Guest name, email, phone, party size, date | Table booking and confirmation |
| **Door admissions** | ID verification (age check), party size, entry time | Legal drinking age verification, capacity management, safety |
| **Sales leads** | Name, email, phone, venue name, city | Responding to demonstration requests |

### 2.2 Information collected automatically

| Category | Examples | Purpose |
|---|---|---|
| **Session data** | Login tokens, IP address, user agent | Authentication, security, rate limiting |
| **Error logs** | Stack traces, request metadata (PII scrubbed before sending) | Error diagnosis and resolution |

### 2.3 Information we do NOT collect

- Payment card data (processed by Stripe — never touches our servers)
- Precise geolocation
- Browsing history across sites
- Advertising identifiers
- Cookies beyond what session mechanics require (auth session cookie,
  locale preference cookie, guest session cookie — all strictly necessary)

---

## 3. How we use it

All collection has a lawful basis under Law 25 and PIPEDA:

- **Contract necessity:** delivering the platform services — authentication,
  order processing, reservation management, table assignments, staff
  scheduling.
- **Legal obligation:** age verification (liquor licensing), incident
  documentation (workplace safety), tax and employment records (Quebec
  labour law).
- **Legitimate interest:** security monitoring, fraud prevention, aggregate
  analytics for venue operators, service improvement.
- **Consent:** marketing communications, guest photos, promotional
  features. You may withdraw consent at any time by contacting the privacy
  officer.

Guest marketing consent (email and SMS) is stored per profile and can be
managed by the venue or by the guest through a request.

---

## 4. How we share it

We share personal information only as necessary:

| Recipient | What | Why |
|---|---|---|
| **The venue you interact with** | Your orders, reservations, profile | The venue is the data controller for guest and staff data — our platform is the tool they use |
| **Stripe** | Payment processing | Your card data goes directly to Stripe; we do not receive or store it |
| **Resend** | Email delivery | Transactional and notification emails |
| **Sentry (Functional Software Inc.)** | De-identified error context | Error diagnosis — PII is scrubbed before sending to Sentry, which is hosted in the United States |
| **OVHcloud** | All platform data | Infrastructure hosting in Beauharnois, Quebec, Canada |

We do NOT sell personal information. We do not share it with data brokers,
advertisers, or any third party not listed above.

---

## 5. How long we keep it

Retention is governed by our [Data Inventory & Retention Schedule](/DATA-INVENTORY.md):

- **Guest sessions:** anonymized 90 days after closure (names and profile
  links removed; financial aggregates preserved for venue analytics).
- **Reservations:** personal fields anonymized 6 months after completion.
- **Staff records:** retained for the duration of employment plus 3 years
  (Quebec labour law minimum).
- **Incident records:** 3 years standard, 7 years if reportable to
  authorities.
- **Inactive guest profiles:** deleted 24 months after last visit, unless an
  earlier erasure request is received.
- **Backups:** daily for 7 days, weekly for 4 weeks, monthly for 12 months.
  Individual records cannot be removed from backup files — deletion affects
  the live database; backup copies age out on the stated schedule.

The full retention schedule with per-data-class detail is published in the
[Data Inventory & Retention Schedule](/DATA-INVENTORY.md).

---

## 6. Your rights

Under Law 25 and PIPEDA, you have the right to:

- **Access:** know what personal information we hold about you.
- **Rectification:** correct inaccurate or incomplete information.
- **Erasure:** request deletion of your personal information, subject to
  legal retention obligations (e.g., outstanding payments, active
  investigations, statutory employment records).
- **Portability:** receive your information in a structured, commonly used
  format.
- **Withdraw consent:** for any processing based on consent (marketing,
  photos).
- **Complain:** to the Commission d'accès à l'information du Québec (CAI)
  or the Office of the Privacy Commissioner of Canada if you believe your
  rights have been violated.

To exercise these rights, contact the privacy officer at **[EMAIL]**.
We will respond within 30 days as required by Law 25. You may need to verify
your identity before we can process your request.

---

## 7. Security

We implement technical and organizational measures to protect personal
information:

- **Encryption:** all data in transit (TLS 1.3) and at rest (encrypted
  PostgreSQL storage).
- **Access control:** role-based access (manager, host, bartender, runner,
  security) enforced at the application layer; platform administrators have
  access only to operational data necessary for support.
- **Tenant isolation:** every database query is scoped by venue — venue A's
  data is not accessible from venue B's context.
- **Audit logging:** administrative actions and sensitive operations are
  logged with actor identity.
- **Incident response:** we maintain a breach register and an incident
  response procedure (published in our operations runbook). In the event of
  a confidentiality breach presenting a risk of serious injury, we will
  notify the CAI and affected individuals as required by Law 25.

---

## 8. Cookies

We use only strictly necessary cookies:

| Cookie | Purpose | Duration |
|---|---|---|
| `better-auth.session_token` | Authenticated session | Session |
| `nln-locale` | Language preference (English/French) | Persistent |
| `nln-guest-session` | Guest QR ordering session | Session |

No consent banner is presented because no non-essential cookies are used.
This is documented here for transparency — per Quebec Law 25, consent is
not required for cookies strictly necessary for the service requested by
the user.

---

## 9. Age of users

This platform is for nightclub operations. Guests must meet the legal
drinking age of the venue's jurisdiction (minimum 18, configurable per
venue; 18 is the default in Quebec). We do not knowingly collect
information from persons under 18. Door staff verify age at admission;
the platform records the verification but not the full ID document.

---

## 10. International transfers

All platform data is hosted in Beauharnois, Quebec, Canada (OVHcloud).
One sub-processor, Sentry (error tracking), processes de-identified error
context in the United States. PII is removed from error payloads before
transmission — see our [Data Inventory](/DATA-INVENTORY.md) for the
scrubbing procedure.

---

## 11. Changes to this policy

We will update this policy as the platform evolves. Material changes will
be communicated to venue customers (our direct clients) by email or
in-app notice. The date at the top of the page reflects the most recent
revision.

---

## 12. Contact

**Privacy officer:** [NAME]  
**Email:** [EMAIL]  
**Address:** [ADDRESS]

**Supervisory authorities:**

- Commission d'accès à l'information du Québec (CAI): [cai.gouv.qc.ca](https://www.cai.gouv.qc.ca)
- Office of the Privacy Commissioner of Canada: [priv.gc.ca](https://www.priv.gc.ca)
