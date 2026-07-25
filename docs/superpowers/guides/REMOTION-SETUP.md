# NightLife Remotion Setup Guide

One-time setup for the promo-video toolchain. **Remotion runs as its own project**, separate from the Next.js app — it imports data/tokens from the app but renders standalone. Read this once; then follow `REMOTION-PROMO-QUICKSTART.md` per video.

> Verified against the `remotion-best-practices` skill (Feb 2026). Where this guide and the skill disagree, the skill wins — it tracks the installed Remotion version. Prefer `npx create-video` / `npx remotion add` over hand-editing `package.json`, so versions stay matched.

---

## 1. Scaffold the Remotion project

The app does **not** have Remotion installed (checked: not in `package.json`), and it shouldn't be tangled into the Next build. Scaffold a sibling project. Recommended location: a `promo-video/` folder at the repo root (git-ignored or its own workspace — decide with the team; it ships no app code).

```bash
# From the repo root
npx create-video@latest --yes --blank promo-video
cd promo-video
npm i
```

`--blank` gives a minimal composition. We add Tailwind + fonts below.

Verify:
```bash
npx remotion versions
```

---

## 2. Add the packages we use

Always add Remotion-family packages with `npx remotion add` so the versions match your Remotion core:

```bash
npx remotion add @remotion/google-fonts   # Anton, Cormorant, Geist
npx remotion add @remotion/transitions     # scene cuts (fade/slide/wipe)
npx remotion add @remotion/media           # <Audio> / <Video>
npx remotion add zod                        # typed composition props
```

Regular npm packages install normally:
```bash
npm i lucide-react
```

---

## 3. Enable Tailwind (optional but recommended)

Tailwind is NOT on by default in a `--blank` scaffold. Follow the official step (the skill's `remotion-create/tailwind.md` points here): https://www.remotion.dev/docs/tailwind — it adds `@remotion/tailwind-v4` and enables it in `remotion.config.ts` via `enableTailwind()`.

**Rule that never changes:** inside Remotion, never use Tailwind `animate-*` or `transition-*` classes. They rely on wall-clock time and will not render. Animate with `useCurrentFrame()` + `interpolate()` only. Tailwind is for static layout/color; motion is always frame-driven.

If you skip Tailwind, use inline `style` objects everywhere (the spec's examples work either way).

---

## 4. Project structure

```
promo-video/
├── remotion.config.ts          # render config (see §5)
├── package.json
├── public/                     # everything staticFile() references
│   ├── brand/
│   │   └── n-mark.png          # copied from app: public/brand/n-mark.png
│   └── music/
│       └── guest-ordering.mp3  # royalty-free track (see QUICKSTART §2)
└── src/
    ├── index.ts                # registerRoot(RemotionRoot)
    ├── Root.tsx                # <Composition> registrations
    ├── brand.ts                # OKLCH tokens + fonts, one source of truth
    ├── components/             # reusable: OrderCard, VenueFloorMap, StaffAvatar, GlowCard
    └── compositions/
        ├── GuestOrderingFlow.tsx
        ├── ManagerDashboard.tsx
        └── StaffCoordination.tsx
```

Copy the logo across once:
```bash
cp "../public/brand/n-mark.png" public/brand/n-mark.png
```

---

## 5. remotion.config.ts

Keep it minimal. **Do not** hardcode a browser path or invent config methods — Remotion finds/downloads its own Chrome Headless Shell. Enable Tailwind here only if you did §3.

```ts
import { Config } from "@remotion/cli/config";
// import { enableTailwind } from "@remotion/tailwind-v4"; // only if using Tailwind

Config.setVideoImageFormat("jpeg");
Config.setConcurrency(4);

// Config.overrideWebpackConfig((c) => enableTailwind(c)); // only if using Tailwind
```

---

## 6. Entry point + Root

**`src/index.ts`**
```ts
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
```

**`src/Root.tsx`** — every `<Composition>` here shows up in Studio and is renderable by `id`. Register landscape + mobile variants per scenario.

```tsx
import React from "react";
import { Composition } from "remotion";
import { GuestOrderingFlow } from "./compositions/GuestOrderingFlow";
import { ManagerDashboard } from "./compositions/ManagerDashboard";
import { StaffCoordination } from "./compositions/StaffCoordination";

const FPS = 30;

export const RemotionRoot: React.FC = () => (
  <>
    {/* Tier 1.1 — Guest Ordering Flow (13s) */}
    <Composition
      id="guest-ordering-landscape"
      component={GuestOrderingFlow}
      durationInFrames={13 * FPS}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="guest-ordering-mobile"
      component={GuestOrderingFlow}
      durationInFrames={13 * FPS}
      fps={FPS}
      width={1080}
      height={1920}
    />

    {/* Tier 1.2 — Manager Dashboard (15s) */}
    <Composition
      id="manager-dashboard-landscape"
      component={ManagerDashboard}
      durationInFrames={15 * FPS}
      fps={FPS}
      width={1920}
      height={1080}
    />

    {/* Tier 1.3 — Staff Coordination (14s) */}
    <Composition
      id="staff-coordination-landscape"
      component={StaffCoordination}
      durationInFrames={14 * FPS}
      fps={FPS}
      width={1920}
      height={1080}
    />
  </>
);
```

> Prefer per-composition duration/props via `calculateMetadata` when a video's length depends on its data — see the skill's `remotion-markup/calculate-metadata.md`.

---

## 7. Brand tokens — one source of truth

**`src/brand.ts`** copies the exact values from the app's `src/app/globals.css` (dark mode) and loads the real fonts. This is the seam that keeps video and product identical — when the app's gold shifts, update here too.

```ts
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadCormorant } from "@remotion/google-fonts/Cormorant";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";

export const fonts = {
  display: loadAnton().fontFamily,                                  // headlines (uppercase)
  voice: loadCormorant("normal", { weights: ["500"] }).fontFamily,  // italic atmosphere
  sans: loadGeist("normal", { weights: ["400", "600"] }).fontFamily,
};

// Dark-mode OKLCH tokens, verbatim from globals.css `.dark`.
// Browsers render OKLCH directly; keep the strings so gold never drifts.
export const BRAND = {
  background: "oklch(0.135 0.016 60)",   // warm charcoal
  foreground: "oklch(0.96 0.012 75)",    // ivory text
  mutedFg: "oklch(0.68 0.025 65)",
  card: "oklch(0.185 0.024 66)",
  gold: "oklch(0.8 0.095 84)",
  goldBright: "oklch(0.87 0.08 88)",
  goldDeep: "oklch(0.68 0.105 76)",
  charcoalInk: "oklch(0.17 0.03 55)",    // text ON gold foil
  destructive: "oklch(0.62 0.23 15)",
  // Cool zone/data colors — zone chips only, never brand accent:
  zone: {
    violet: "#8b5cf6", fuchsia: "#d946ef", cyan: "#06b6d4",
    amber: "#f59e0b", emerald: "#10b981", rose: "#f43f5e",
  },
} as const;

// Reusable easing curves, matching globals.css:
export const EASE = {
  fadeUp: [0.16, 1, 0.3, 1] as const,   // entrances
  popIn: [0.34, 1.56, 0.64, 1] as const, // overshoot (confirmations)
  premium: [0.4, 0, 0.2, 1] as const,    // lifts/glows
};
```

Usage: `Easing.bezier(...EASE.fadeUp)`.

---

## 8. Preview & first render

```bash
# Long-running Studio (prints a localhost URL)
npx remotion studio --no-open

# List composition ids
npx remotion compositions

# One-frame sanity check (frame 30 = 1s at 30fps), quarter-scale = fast
npx remotion still guest-ordering-landscape out/check.jpg --frame=30 --scale=0.25

# Full render
npx remotion render guest-ordering-landscape out/guest-ordering.mp4 --concurrency 4
```

---

## 9. git hygiene

Add to `promo-video/.gitignore` (or the repo root, scoped):

```gitignore
# Remotion
promo-video/out/
promo-video/node_modules/
.remotion/
# Large binary assets — store on a CDN/shared drive, not git:
promo-video/public/music/*.mp3
```

Keep source compositions and `brand.ts` in git; keep rendered `.mp4`s out (they belong on a CDN — matches how `promo-output/` PNGs are handled today).

---

## 10. Cloud rendering (only if/when volume needs it)

Local renders are fine for a handful of clips. If you later automate or batch, Remotion offers **Lambda** (`@remotion/lambda`) and **Cloud Run** — both have their own deploy + IAM steps. Don't set this up speculatively. When the need is real, follow the current official guide (https://www.remotion.dev/docs/lambda) rather than any snippet here — the CLI (`npx remotion lambda …`) is the source of truth for the commands and versions.

---

## 11. Troubleshooting

| Issue | Fix |
|-------|-----|
| Animation doesn't move in the render | You used a CSS/Tailwind `transition`/`animate` class. Convert to `useCurrentFrame()` + `interpolate()`. |
| Font renders as fallback | `loadFont()` not called at module top level, or wrong weight requested. Import `brand.ts` early. |
| `staticFile` 404 | Asset isn't under the Remotion project's `public/`. Copy it there; path is relative to `public/`. |
| Wrong playback speed | `durationInFrames` ≠ `seconds × fps`. Recompute. |
| Studio port busy | `npx remotion studio --port 3011 --no-open`. |
| Render slow / OOM | Lower `--concurrency`; iterate with `npx remotion still` not full renders. |
| Tailwind classes do nothing | Tailwind not enabled in `remotion.config.ts` (§3), or you're using forbidden `animate-*` classes. |

---

## Resources
- Skill (authoritative for the installed version): `~/.claude/skills/remotion-best-practices/`
- Remotion docs: https://www.remotion.dev/docs
- App design system: `src/app/globals.css`, `src/lib/zone-colors.ts`, `src/components/shared/brand-logo.tsx`
- Spec: `docs/superpowers/specs/PROMO-VIDEO-SPEC.md`
- Build walkthrough: `docs/superpowers/guides/REMOTION-PROMO-QUICKSTART.md`

---

**Document Version:** 1.1 · **Last Updated:** 2026-07-25
