# Luxe VIP Gold — Visual Identity Revamp · DESIGN SPEC

**Date:** 2026-07-16
**Status:** Approved (direction), pending implementation plan (plan 11)
**Mockup:** guest ordering screen — `scratchpad/luxe-vip-mockup.html` (published artifact)

## Problem

The app reads as "generic AI-generated" despite already carrying a deliberate
"Ember" system (warm charcoal ground, amber/gold brand gradients, Anton display
font, `.text-outline` poster lettering, `.glow-primary`). Four specific failures,
all confirmed with the user:

1. **Safe, flat layouts** — evenly-spaced cards in tidy grids, no focal points,
   no sense of a "stage."
2. **Typography lacks punch** — clean but polite; no editorial/poster energy, no
   scale contrast.
3. **Color feels muted/timid** — the ember palette exists but is barely visible;
   mostly gray surfaces with tiny accent touches.
4. **No texture or atmosphere** — flat solid backgrounds; missing depth, grain,
   glow, and lighting that make a venue feel alive.

The identity lives in the *tokens* but was never *pushed* into layouts, type, and
texture. This is an evolution of the existing system, not a rewrite.

## Direction: Luxe VIP Gold

Bottle-service exclusivity. Deep warm-charcoal/near-black ground + champagne gold
+ ember, with refined serif "voice" touches. Feels expensive, members-only,
low-lit lounge — restraint plus richness. Chosen over Neon Noir, Underground
Warehouse, and Miami Synthwave because it *builds on* the existing Ember palette
and keeps the diff surgical.

**Both light and dark modes ship at full parity** — the luxe identity is pushed
equally hard in both. Dark is the natural hero ground, but light is not
second-class.

## Design principles (the how)

1. **Atmosphere, not flat fills.** Warm near-black ground with ember light
   bleeding from focal edges. Depth via layered charcoal gradients and glow, not
   a flat gray card sea.
2. **Type carries the identity.** Heavy condensed poster display (evolving Anton)
   for venue/section names, in gold-foil gradient; an italic serif "voice" for
   descriptive/atmospheric copy; a clean sans for body and data. Real weight,
   width, and spacing contrast — type is a memorable part of the design, not a
   neutral delivery vehicle.
3. **Gold is a material, not an accent dot.** Champagne gold reads as foil and
   light — gradient rules, glowing edges, foil CTAs — deployed with restraint so
   it carries meaning instead of becoming wallpaper.
4. **One thing glows at a time.** Focal hierarchy: the hero element (house pour,
   primary CTA, the night's headline metric) is elevated with a gold/ember halo;
   everything around it stays quiet. Spend boldness in one place per view.
5. **Accessibility is not negotiable.** Gold-on-charcoal and ivory-on-charcoal
   pairings meet WCAG AA; glow and grain never carry information; all motion
   respects `prefers-reduced-motion` (the existing pattern in `globals.css`).

## Color system

Extends the current OKLCH token set in `src/app/globals.css`. New/deepened
tokens (illustrative hex from the mockup; final values authored in OKLCH to match
the existing convention and pass AA in both modes):

- **Grounds:** warm near-black `#0E0B08` → charcoal `#1A1510` → elevated
  `#221B14`. In light mode, the warm-ivory ground already present (`--background`
  ~ `oklch(0.98 0.008 80)`) is retained and enriched.
- **Champagne gold ramp:** bright `#EBCE93` → gold `#D8B673` → deep. A dedicated
  ramp (not just `--primary`) so foil gradients, rules, and text have a coherent
  set of stops.
- **Ember:** `#C8642A` (retains current `--primary` hue family) for warmth,
  glow, and the second gradient stop.
- **Ink:** ivory `#F3EDE1` / dim ivory `#B9AE9B` on dark; existing warm-charcoal
  foreground on light.
- **Data colors stay cool.** Zone/persona colors (violet, cyan, fuchsia, emerald,
  rose in `zone-colors.ts`) remain the categorical data palette — the luxe warm
  system is brand/chrome, the cool set is data. This separation is preserved.

## Typography

Three roles, replacing the current single-sans-plus-Anton setup:

- **Display / poster** — condensed heavy face (evolve Anton usage): venue names,
  section headers, hero numbers. Gold-foil gradient treatment
  (`text-gradient-brand`, deepened), optional `.text-outline` hollow variant for
  secondary poster moments.
- **Voice / serif** — an italic serif for descriptive and atmospheric copy (menu
  descriptions, empty-state invitations, editorial lines). This is the single
  biggest lever for "escaping generic," and is currently absent.
- **Body / data** — clean sans (retain Geist) for UI, forms, tables;
  `tabular-nums` for all money and counts (existing rule, kept).

A real type scale with intentional weights and letter-spacing on uppercase
labels. Fonts inlined per the existing `next/font` setup (no CDN dependency).

## Texture & atmosphere primitives

New reusable helpers (extend the `globals.css` utility block):

- **Glow utilities** — generalize `.glow-primary` into a small set
  (`.glow-gold`, `.glow-ember`, focal-halo for featured cards).
- **Grain overlay** — a subtle SVG fractal-noise overlay at very low opacity,
  `mix-blend-mode: overlay`, for header/atmosphere zones. Decorative only,
  `pointer-events: none`, hidden from a11y tree.
- **Gradient rules** — gold hairline section dividers that fade to transparent.
- **Foil helpers** — the gold-gradient CTA/pill treatment as a utility.

## Motion

The nightclub *energy* lives here — driven by the **motion-design** skill (see
plan 11). Building on the existing keyframes (`nln-fade-up`, `nln-pop-in`,
`nln-bounce-soft`, `stagger-children`, `nln-marquee`):

- **Entrance choreography** — staggered fade-up on lists/menus, already seeded;
  extend to guest and ops surfaces with tuned timing/easing.
- **Ambient atmosphere** — slow, low-amplitude ember-glow pulse on focal
  elements (respecting reduced-motion). Restraint is the rule: ambient motion
  should feel like a venue's lighting, not a screensaver.
- **Micro-interactions** — foil-shimmer on primary CTA hover, gold-halo lift on
  card hover/press, tab-switch transitions. Applied through motion-design's
  timing/easing/choreography guidance, not ad-hoc.
- **Reduced motion** — all of the above collapse under the existing
  `@media (prefers-reduced-motion: reduce)` block.

## Component treatments

Upgrade shared primitives once so every page inherits the identity
(`src/components/shared/*`): cards (depth + focal-halo variant), badges/chips
(foil + zone-data variants), buttons (foil-gradient primary), section headers
(gold gradient-rule pattern), `BrandLogo`, `MetricCard` (poster hero numbers),
empty states (serif-voice invitations), `RevenueChart` (Recharts, gold/ember series styling).

## Scope & sequencing

Approved sequence: **Foundation design-system layer → `/guest` (highest-vibe,
customer-facing) → public marketing surfaces → roll to ops areas**
(`/manager`, `/staff`, `/admin`).

1. **Foundation** — extended tokens, typography scale, texture/motion primitives,
   upgraded shared components. No page-level churn yet.
2. **Guest** — apply fully to `/guest` (mobile-first QR ordering); prove the
   identity where it matters most.
3. **Public marketing surfaces** — the live landing page
   (`src/app/(public)/page.tsx`, the live build's `/`), the demo tour page
   (`/demo`, `src/components/demo/demo-tour-page.tsx`), plus `/pricing` and
   `/lead` which share the `(public)` layout. These are the first impression —
   the surfaces where "generic AI-generated" is most costly — and they get the
   **full editorial treatment**: poster-type hero as a thesis, atmospheric
   ground, foil CTAs, orchestrated entrance moment. The whole funnel
   (landing → pricing → lead → demo tour) must read as one visual world.
   Per-build routing is preserved: demo `/` → `/demo`, `/pricing` 404s in demo,
   live CTAs cross-link to the demo app's `/lead` (see AGENTS.md appendix).
4. **Ops rollout** — manager, staff, admin inherit the upgraded primitives; tune
   per-surface density (ops screens are scanned/operated, not read).

## Track & invariants

This is a **demo-track / presentation-layer** change (AD-14). It touches the
shared design-system layer (`globals.css`, `zone-colors.ts` neighbors, shared
components) — no new service, schema, or `types.ts` change. The demo and live
builds share this chrome, so both inherit the revamp automatically.

Phase-independent UX invariants (§9.8) must not regress: confirmation dialogs on
consequential actions, loading skeletons, empty states, toast feedback, entity
cross-links, deterministic money display, and accessibility (`aria-label`,
`Label htmlFor`, keyboard reachability).

## The two skills this phase depends on

- **impeccable** — the design-system authority for this work: token/typography
  system, visual hierarchy, component polish, cognitive load, accessibility, and
  the "bland → bold, technically extraordinary" push. Drives foundation and each
  surface's visual pass.
- **motion-design** — the atmosphere-and-energy authority: entrance
  choreography, ambient glow, micro-interactions, timing/easing, and
  reduced-motion discipline. Drives the motion primitives and every interactive
  treatment.

Both are crucial and non-optional for this phase — see plan 11 for where each is
invoked in the workstream order.
