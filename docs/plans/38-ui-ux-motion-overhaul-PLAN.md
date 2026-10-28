# 38 — UI/UX & Motion Overhaul · PLAN

Scope: the live app and the demo app (manager, staff, guest), the live landing
(`/`) and the demo landing (`/demo`). Motion is aimed at the guest-facing
pages first. Built as reviewable PRs, one surface per PR.

## Audit (2026-10-28)

- **Motion is already a system.** GSAP is centralised in `src/lib/gsap.ts`;
  `src/components/fx/` holds Reveal, CountUp, AnimatedMoney, ClubLights
  (three.js), Spotlights, Magnetic and TiltCard; `globals.css` holds the CSS
  keyframes (fade-up, pop-in, marquee, shimmer, glow). The plan builds on this
  rather than adding a new animation library.
- **Reduced-motion gaps.** Reveal, CountUp, AnimatedMoney and the cart pill
  bounce ignored `prefers-reduced-motion`. `animate-pulse` (the hero ops dot)
  and `.order-connector` were not in the CSS reduced-motion block.
- **Duplicated checks.** `matchMedia("(prefers-reduced-motion…)")` is written
  inline in club-lights, spotlights and item-detail. PR 1 adds
  `src/lib/motion.ts` for new call sites; the older ones move in a later
  cleanup, not this PR.
- **Live landing.** Hero entrance is gated with `gsap.matchMedia`, which is the
  right pattern. Module index, pricing and final CTA rely on Reveal only.
  The scroll hint is hidden on small screens.
- **Demo landing.** Long tour: sidebar, tabs, feature blocks, quick-jump pills.
  Motion is limited to Reveal and Spotlights; tab switches have no transition.
- **Guest.** Route change fades the `main` (keyed by pathname). The menu grid has
  no stagger. Cart pill bounces on add. Touch targets and status changes need a
  review pass.
- **Manager and staff shells** (28 and 12 pages) are the largest surface and
  get the last pass: navigation indicator, empty and skeleton states, focus
  rings.
- **Tooling.** `npm run lint` crashes in this environment (eslint-plugin-react
  calls `getFilename`, unsupported by ESLint 10). `tsc --noEmit` is clean after
  `prisma generate`, apart from the PNG image typings that `next dev` writes into
  `next-env.d.ts`.

## PR sequence

1. **Motion foundation and reduced-motion** (this PR). Helper, gated fx and
   cart, CSS coverage, this plan.
2. **Guest surface.** Menu stagger and tap feedback, cart and orders status
   transitions, QR entry and waiting screen polish, 44px touch targets.
3. **Live landing.** Hero, night timeline, module index, pricing, final CTA,
   mobile layout.
4. **Demo landing.** Tour sidebar, tab indicator, feature block reveal, mobile
   layout.
5. **Staff and manager shells.** Navigation indicator, page transition,
   empty and skeleton states, focus-visible rings.

## Rules for every PR

- Animate `transform` and `opacity` only. Entrances ≤ 600ms, micro-interactions
  ≤ 250ms, `power3.out` or `expo.out` style easing.
- Every motion has a reduced-motion path: no motion, or the final state
  instantly. Content is visible without JS or scroll triggers.
- Motion never carries information alone; labels and status text stay.
- Spinners stay as loading indicators. No new decorative loops on guest pages.
- Verify with `tsc --noEmit`, `npm test`, and a Playwright check with
  `reducedMotion: "reduce"` at 390px and desktop widths.

## Exit criteria

- All five surfaces reviewed and each PR merged.
- No content hidden under `prefers-reduced-motion: reduce` on any audited page.
- Guest pages keep 44px touch targets and AA contrast in both themes.
