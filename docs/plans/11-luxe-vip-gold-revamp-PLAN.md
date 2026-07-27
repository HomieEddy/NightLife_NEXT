# 11 — Luxe VIP Gold Visual Revamp · PLAN

**Status: complete.**

Goal: give the app a distinctive nightclub identity — "Luxe VIP Gold" — that
escapes the generic AI-generated look, by pushing the existing champagne-gold
system into layout, typography, color, and texture. A cross-cutting
**presentation-layer** change: shared design-system tokens/primitives first, then
`/guest`, then the public marketing surfaces (live landing, demo tour, pricing,
lead), then the ops areas. No new schema, service, or `types.ts` change.

Spec: `docs/superpowers/specs/2026-07-16-luxe-vip-gold-design.md`.
Preconditions: none functional — this rides on top of every shipped plan (01–10).
Both demo and live builds share this chrome, so both inherit the revamp.

> **Deviation (post-review):** the original design spec retained an amber/orange
> tone as a co-accent beside the gold ramp. User review asked for the orange tone
> to be removed entirely, so `--primary`, `--chart-1`, sidebar accents, all
> glow helpers, ambient keyframes, hero radials and the ClubLights particle
> palette now sit on the champagne-gold ramp. The historic "Ember" naming is
> retained in CSS custom property names (`--ember-*`) for backward compatibility
> with existing component tokens, but the rendered tones are champagne-gold
> throughout. Semantic status colors (destructive red, warning amber on SLA
> chips, success emerald) and the cool zone/data palette are unchanged.

## Reasoning

The identity already exists in `src/app/globals.css` (champagne-gold system: warm
charcoal ground, gold text gradients, Anton display font, `.text-outline`, `.glow-*`
CSS helpers, the `nln-*` keyframes) — but it lives in the tokens and was never
*pushed* into the actual pages. The failure is one of application and intensity,
not of missing foundation. So the highest-leverage move is to deepen the token
layer and upgrade the shared primitives **once**, then let every page inherit the
identity — rather than restyle page-by-page.

This is a different shape from plans 01–10: there is no mock→service→graduate arc
because nothing persists. The "contract" here is the design-system layer
(`globals.css` tokens + `src/components/shared/*`), and the "harness" is the
preview browser in both modes. Verification is visual and accessibility-driven,
not DB integration tests.

Two skills are load-bearing for this phase and are invoked explicitly in the
workstreams below — this is not decoration, it is how the work gets done:

- **impeccable** — design-system authority: the token/type system, visual
  hierarchy, component polish, cognitive load, accessibility, and the deliberate
  "bland → bold, technically extraordinary" push. Every visual workstream opens
  by invoking it.
- **motion-design** — atmosphere/energy authority: entrance choreography, ambient
  gold glow, micro-interactions, timing/easing, and reduced-motion discipline.
  Owns the motion primitives (WS3) and every interactive treatment.

## Design choices

- **Evolve, don't replace.** Keep the OKLCH token convention and the warm hue
  family. CSS custom properties use the historic `--ember-*` naming for backward
  compatibility with existing component tokens, but rendered values are
  champagne-gold throughout. Values authored in OKLCH to match existing style
  and pass WCAG AA in both modes.
- **Warm chrome, cool data.** The luxe warm palette is brand/chrome only. The
  categorical data colors in `zone-colors.ts` (violet/cyan/fuchsia/emerald/rose)
  stay cool and unchanged — the separation is deliberate and preserved.
- **Three type roles.** Display/poster (evolve Anton, gold-foil), voice/serif
  (new — italic serif for descriptive copy, the single biggest anti-generic
  lever), body/data (retain Geist, `tabular-nums`). Fonts via the existing
  `next/font` setup — no CDN dependency.
- **Texture as reusable primitives, not per-page hacks.** Glow set (`.glow-gold`,
  focal-halo), a low-opacity SVG grain overlay (decorative,
  `pointer-events:none`, a11y-hidden), gold gradient-rule dividers, foil helpers
  — all in the `globals.css` utility block alongside the existing helpers.
- **Both modes at parity.** Every new token/utility is defined for `:root` and
  `.dark`. Dark is the hero ground; light gets equal care (no naive inversion).
- **One glow per view.** Focal hierarchy is a rule, not a suggestion — featured
  card / primary CTA / hero metric gets the halo; siblings stay quiet.
- **No new dependencies.** YAGNI holds — no animation library, no CSS-in-JS. CSS
  keyframes + Tailwind tokens + the motion-design skill's guidance are sufficient
  (motion-design works with the existing CSS animation system).

## Implementation strategy

Presentation-layer, so all workstreams ship on both builds at once. Order is
foundation → guest → ops, matching the approved sequence. Checkpoint with
`npx tsc --noEmit` after each workstream.

**WS1 — Token & color foundation.** *Invoke impeccable.* Extend `globals.css`:
champagne-gold ramp, deepened grounds/elevation, glow/foil color stops — for both
`:root` and `.dark`. Verify AA contrast for every gold/ivory-on-charcoal pairing.
No page changes yet.

**WS2 — Typography system.** *Invoke impeccable.* Add the serif voice face via
`next/font`; define the display/voice/body scale (weights, widths, letter-spacing
on uppercase labels); deepen `text-gradient-brand`; formalize `.text-outline`
usage. Ship as tokens + utilities.

**WS3 — Texture & motion primitives.** *Invoke motion-design* (with impeccable for
the static texture). Glow utilities, grain overlay, gradient-rule dividers, foil
helpers; extend the `nln-*` keyframes with ambient champagne-gold glow pulse and
micro-interaction transitions (foil-shimmer, gold-halo lift). Everything collapses
under the existing `prefers-reduced-motion` block.

**WS4 — Shared component upgrade.** *Invoke impeccable + motion-design.* Apply
WS1–3 to `src/components/shared/*` once: cards (depth + focal-halo variant),
badges/chips (foil + zone-data variants), buttons (foil-gradient primary), section
headers (gradient-rule), `BrandLogo`, `MetricCard` (poster hero numbers), empty
states (serif-voice), `MockChart` (gold series). This is the leverage point
— pages inherit from here.

**WS5 — Guest surface.** *Invoke impeccable + motion-design.* Apply fully to
`/guest` (mobile-first QR ordering) — the mockup made real: atmospheric header,
gold section rules, bottle-service cards with focal hierarchy, foil CTAs, entrance
choreography. Prove the identity where it matters most.

**WS6 — Public marketing surfaces.** *Invoke impeccable + motion-design.* The
first-impression funnel, full editorial treatment: the live landing page
(`src/app/(public)/page.tsx` — the live build's `/`), the demo tour page
(`/demo` via `src/components/demo/demo-tour-page.tsx`), `/pricing`, and `/lead`
(all share the `(public)` layout — restyle it once, tune per page). Poster-type
hero as a thesis, atmospheric ground with gold glow and grain, foil CTAs, one
orchestrated entrance moment (motion-design owns the choreography). The funnel
must read as a single visual world — landing → pricing → lead → demo tour.
Per-build routing is untouched: demo `/` redirects to `/demo` and `/pricing`
404s there; live CTAs cross-link to the demo app's `/lead` via
`NEXT_PUBLIC_DEMO_URL` (AGENTS.md appendix) — verify both builds render their
own home correctly after the reskin.

**WS7 — Ops rollout.** *Invoke impeccable* per area. Manager, staff, admin inherit
the upgraded primitives; tune per-surface density (ops screens are scanned and
operated, not read — restraint over atmosphere). One workstream per area, in
order: manager → staff → admin.

## Testing

No test suite change — this is presentation-layer with no logic to unit-test.
Verification is the §5 ladder, weighted to visual/a11y evidence:

- **`npx tsc --noEmit`** green after every workstream; **`npx eslint src`** clean
  for what's introduced.
- **Contrast audit** — every new token pairing checked against WCAG AA in *both*
  modes (the one hard, objective gate; a failing pair blocks the workstream).
- **Preview drive, both modes** — after WS5–WS7, drive each surface in the preview
  in light *and* dark: exercise flows (guest scan→order, landing → pricing →
  lead funnel, manager dashboard scan), check `read_console_messages` for
  errors, screenshot for layout judgment.
- **Both-build routing check (WS6)** — demo build: `/` redirects to `/demo`,
  `/pricing` 404s; live build: `/` renders the marketing landing, demo CTAs
  point at `NEXT_PUBLIC_DEMO_URL`. The reskin must not disturb either.
- **Reduced-motion** — verify with the emulated `prefers-reduced-motion` setting
  that all `nln-*` and new animations disable.
- **`npx next build`** — before declaring the batch finished (catches the
  `useSearchParams`/Suspense class of error static generation surfaces).
- **UX-invariant regression** — confirm dialogs, skeletons, empty states, toasts,
  entity chips, and `tabular-nums` money display all survive the reskin.

## Review checklist

- Any new color used raw (hex in JSX) instead of a token / Tailwind mapping?
- Every new token defined for **both** `:root` and `.dark`?
- Cool data palette (`zone-colors.ts`) left unchanged — warm system is chrome only?
- Glow/grain purely decorative — no information carried by them, `aria-hidden`,
  `pointer-events:none`?
- All new motion inside the `prefers-reduced-motion` guard?
- Icon-only buttons keep `aria-label`; inputs keep `Label htmlFor`; focus states
  visible against the darker ground?
- One focal glow per view, or did the halo proliferate?
- No new dependency added?
- Ops surfaces tuned for density, not just guest atmosphere copied over?
- Public funnel reads as one visual world (landing/pricing/lead/demo tour), and
  neither build's home routing changed?

## Exit criteria

Guest, the public marketing surfaces (live landing, demo tour, pricing, lead),
and all three ops areas render the Luxe VIP Gold identity in both light and
dark; contrast audit passes AA across the board; reduced-motion disables all
animation; `next build` green; UX invariants intact; the spec's four original
complaints (flat layouts, weak type, timid color, no texture) demonstrably
answered in the preview. AGENTS.md appendix updated if any Phase-1 note about the
old visual system became stale (§9.9); ROADMAP marked with plan 11 complete.
