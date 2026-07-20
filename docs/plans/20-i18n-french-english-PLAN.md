# 20 — i18n: Full French/English Support · PLAN

**Status: not started.**

Goal: the entire app — guest, public/marketing, manager, staff, admin —
operable in French and English, switched by a locale toggle sitting next to
the existing dark-mode button in every shell, persisted per user. For a
product selling to Quebec venues this is not a nicety: the Charter of the
French Language (Bill 96) expects consumer-facing services in French, and
plan 22's bilingual policy pages need an app that can actually render in the
policy's language. The guest ordering flow is where the legal and product
pressure concentrates — a francophone guest scanning a QR must get French.

Preconditions: none hard. Land before or alongside plan 22 (its `/privacy`
and `/terms` render through this plan's locale plumbing); plans 18/19 gain
localized templates here if they've shipped, or ship bilingual from birth if
this lands first. Branch `feature/20-i18n`.

## Reasoning

1. **The cost is the string sweep, not the machinery.** Every page in
   `src/app/**` carries hardcoded English UI strings — labels, empty
   states, toasts, ConfirmDialog titles, aria-labels. The plumbing is a
   day; the extraction is the project. So the plan's structure is:
   machinery once, then per-area workstreams in risk order —
   **guest → public/`/r/[slug]` embed → manager → staff → admin** — each
   independently shippable and verified, consumer-facing surfaces first
   because that's where Bill 96 and actual guests live.
2. **Dependency: `next-intl`, earned.** Hand-rolling a `t()` lookup is easy;
   hand-rolling ICU plurals ("1 commande" / "2 commandes"), locale-aware
   `Intl` wiring, and App Router server/client message loading is not, and
   getting plurals wrong in French is the kind of visible sloppiness plan
   11's luxe polish forbids. `next-intl` is the App Router standard, works
   without locale-prefixed routing, and its typed message keys make `tsc`
   catch a missing translation — the §5 ladder's cheapest rung doing i18n
   review for free.
3. **No URL locale prefixes.** `/fr/manager/orders` would ripple through
   `entity-links.ts`, the proxy guards, QR URLs, and every redirect for
   zero benefit — this is an authenticated ops app, not a content site.
   Locale lives in a cookie (`nln-locale`), readable by server components,
   set by the toggle. Two exceptions get a `?lang=` query override that
   *sets* the cookie on arrival: the `/r/[venueSlug]` embed (a venue's
   French website embeds `?lang=fr`) and links inside notification
   emails/SMS (a guest who booked in French opens a French page). The
   marketing landing reads `Accept-Language` for its first-visit default;
   everywhere else defaults follow the venue (below).
4. **Who decides the default:** staff/manager/admin — their own toggle
   choice, persisted (cookie now; a profile field is a one-line follow-up
   when someone asks for cross-device stickiness). Guests — the venue's
   `guestLocale` setting (new venue field, manager-editable in settings)
   seeds the session's default; the guest toggle still overrides, because
   an anglophone at a French venue is Tuesday in Montréal. This also
   resolves plan 19's "venue's guest-facing language once that setting
   exists" — this plan creates that setting.
5. **Track placement: both, like plan 11.** This is presentation-layer and
   ships identically in demo and live builds — a French demo is a sales
   asset in QC. Mock-data *content* (menu item names, zone names, seeded
   chat) stays as-is: it's venue data, not UI chrome, and real venues'
   data arrives in whatever language they type. Only UI strings translate.

Out of scope: locales beyond fr/en · translating venue-authored content ·
locale-prefixed SEO routing · RTL. Each is a parking-lot line, not a hook
left in the code.

## Design choices

- **Messages:** `src/messages/en.json` + `fr.json`, namespaced per area
  (`guest.cart.*`, `manager.orders.*`, `shared.confirm.*`), typed via
  next-intl's TS augmentation so a key present in `en` and missing in `fr`
  is a build error — the two files cannot drift silently. French is
  written by the owner (a francophone), not machine-glossed; the plan-22
  review rule ("real French") applies to every string.
- **`LocaleToggle`** in `src/components/shared/locale-toggle.tsx`, built as
  `ThemeToggle`'s sibling: ghost icon button (`Languages` from lucide),
  same mounted-guard pattern, `aria-label` bilingual-safe, shows the
  *target* locale ("FR" when in English, "EN" when in French — the
  convention QC users know). Placed beside `ThemeToggle` in
  `ManagerShell`, `StaffShell`, admin shell, guest tabs layout, and the
  public/`/r` layouts — grep for `ThemeToggle` usage and pair every
  instance. Toggling sets the cookie and refreshes; no full reload (demo
  mock state must survive the switch, §3.5).
- **`format.ts` goes locale-aware:** `formatMoney` maps CAD → `fr-CA` /
  `en-CA` by active locale (`1 234,56 $` vs `$1,234.56`); date/time
  helpers take the locale instead of hardcoded `en-GB`. Signatures keep
  working via a locale-context accessor so ~every call site doesn't
  change; `tabular-nums` and cents-rounding rules (§4.4) are untouched.
- **Notification templates (plans 18/19) localize by recipient:**
  reservation confirmations/PIN SMS follow the locale the guest booked in
  (captured on the reservation — new field, defaulted from venue
  `guestLocale`); staff invites follow the inviting venue's admin locale.
  Templates become per-locale variants in the same files; dispatch picks.
- **Hardcoded-string backstop:** enable an ESLint no-literal-jsx-strings
  rule *per directory as each workstream completes* (start with
  `src/app/(guest)` and `src/app/(public)`), so swept areas can't regress
  while unswept areas don't drown in warnings. The sweep order is the
  enablement order.
- **`<html lang>`** reflects the active locale (a11y + Law 25-adjacent
  transparency); `metadata` titles/descriptions localized for the public
  pages.

## Implementation strategy

Each numbered step is a commit-sized workstream with the ladder run (§2.3):

1. Machinery: next-intl (no routing integration), cookie plumbing,
   `LocaleToggle` paired with every `ThemeToggle`, typed message scaffold,
   `format.ts` locale awareness. App still 100% English — `fr.json`
   mirrors `en.json` — proving the plumbing changes nothing.
2. Shared primitives: ConfirmDialog defaults, empty-state/skeleton copy,
   toasts in `src/components/shared/`, nav labels.
3. Guest area sweep + French (+ venue `guestLocale` setting in manager
   settings, reservation locale capture, `?lang=` on `/r/[slug]`).
4. Public/marketing + `/privacy`/`/terms` wiring (plan 22 rendezvous) +
   login/invite pages.
5. Manager area sweep + French.
6. Staff area sweep + French.
7. Admin area sweep + French (platform admin may stay lower-polish
   English-first if scope demands — it's internal; note the call in the
   PR if taken).
8. Notification template variants (or fold into 18/19 if unshipped).

## Testing

- `tsc` enforces key parity (typed messages) — missing French is a build
  failure, the suite's cheapest and strongest check.
- Unit: `formatMoney`/date helpers per locale (the `fr-CA` narrow
  no-break space in `1 234,56 $` is a classic snapshot trap — assert with
  it, not around it); locale-resolution matrix (cookie > `?lang=` > venue
  default > `Accept-Language`).
- Integration (PGlite): reservation stores booking locale; venue
  `guestLocale` round-trips through settings; notification dispatch picks
  the right template variant.
- Behavioral (§5): drive the guest flow end-to-end in French (scan → join
  → order → PIN gate) in both builds; toggle mid-cart and confirm state
  survives (no reload, §3.5); embed with `?lang=fr` renders French from
  first paint; print QR sheet and reports render sanely in French (longer
  strings — French runs ~20% wider; check the tight spots: badges, table
  chips, MockChart labels).
- `npx next build` both modes per workstream — locale work touches
  server/client boundaries where Suspense mistakes hide.

## Review checklist

- Every `ThemeToggle` has its `LocaleToggle` sibling — grep-verified, not
  sampled.
- No layout breakage from French string length in chips, badges, buttons,
  and the floor map (drive them, don't eyeball the JSON).
- French is idiomatic Québécois product French (courriel, not e-mail;
  commande, not ordre) — owner-read, per the plan-22 rule.
- Money/date formatting locale-correct while cents math and
  `tabular-nums` stay untouched.
- Toggling never resets demo mock state or the guest cart.
- ESLint literal-string rule enabled exactly for swept directories.
- `en.json`/`fr.json` key parity enforced by types, not by diligence.

## Exit criteria

A francophone guest completes scan → order → PIN entirely in French on
both builds; every shell shows the locale toggle beside the theme toggle
and the choice persists across navigation; venue settings control the
guest default; money and dates format per locale; notification templates
send in the recipient's language (or plans 18/19 inherit the variants);
and no swept surface can regress to hardcoded English without a lint or
type error.
