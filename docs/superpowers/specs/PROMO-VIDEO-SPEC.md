# NightLife Promotional Video Specification (10-15sec Remotion Clips)

**Purpose:** Guidelines for AI agents using Remotion to generate short, focused promotional clips showcasing NightLife features. Each clip should be 10–15 seconds, ready for social media, landing pages, and partner materials.

**Audience:** AI agents (e.g., Claude + Remotion skill), human reviewers, marketing teams.

---

## 1. Technical Specs

### Duration & Format
- **Target length:** 10–15 seconds (hard cap: 16 seconds)
- **Frame rate:** 30 fps (matches standard social/web)
- **Resolution:** 1080p (1920×1080) for landscape; 1080×1920 for mobile/Stories
- **Aspect ratios to support:**
  - **Landscape (16:9):** primary for demo/landing pages and YouTube
  - **Mobile (9:16):** TikTok, Instagram Reels, Stories
  - **Square (1:1):** LinkedIn, fallback social feeds
- **Codec:** H.264 MP4 (universal playback, small file size)
- **Audio:** 48 kHz stereo, license-free background music (no copyright strikes)

### Rendering & Delivery
- Render to MP4 via Remotion Lambda or local CLI: `npx remotion render <composition-name>`
- Output directory: `promo-output/videos/<role>-<feature>-<date>.mp4`
- Maximum file size: 50MB (optimize via bitrate: 6–8 Mbps for 1080p, 4–5 Mbps for mobile)
- Include captions/subtitles as `.srt` (not burned-in; overlaid by platforms or burned in for accessibility)

---

## 2. Visual Identity & Branding

**The app already has a specific, opinionated identity — the "Ember system" (`src/app/globals.css`). Match it exactly; do not invent a new palette.** Champagne-gold accents on warm charcoal, amber-orange as the brand primary, cool "data" colors (violet/cyan/fuchsia…) reserved for zone/persona tokens only.

### Color Palette (source of truth: `src/app/globals.css`)
The app defines colors in **OKLCH** CSS variables, themed light/dark. Videos render in **dark mode** (the club-night look). Below are the dark-mode values plus sRGB-hex approximations for tools that can't take OKLCH — but **prefer copying the exact `oklch(...)` strings** into a shared `brand.ts` (see §7) so the video and the app never drift.

| Token | Dark-mode OKLCH | ≈ Hex | Usage |
|-------|-----------------|-------|-------|
| `--background` | `oklch(0.135 0.016 60)` | `#211d18` | Warm charcoal ground (scene background) |
| `--foreground` | `oklch(0.96 0.012 75)` | `#f5f1ea` | Primary ivory text |
| `--gold` | `oklch(0.8 0.095 84)` | `#e0b878` | Champagne gold — the signature accent |
| `--gold-bright` | `oklch(0.87 0.08 88)` | `#eecfa0` | Gold highlight / gradient top stop |
| `--gold-deep` | `oklch(0.68 0.105 76)` | `#bd925a` | Gold shadow / gradient bottom stop |
| `--primary` | `oklch(0.8 0.095 84)` | `#e0b878` | Brand primary (= gold in dark) |
| `--card` | `oklch(0.185 0.024 66)` | `#2b2620` | Elevated surface |
| `--muted-foreground` | `oklch(0.68 0.025 65)` | `#a99f92` | Secondary text |
| `--destructive` | `oklch(0.62 0.23 15)` | `#d24a3a` | Alerts, urgency (low stock) |

**Zone/data colors** (cool, from `src/lib/zone-colors.ts`) — use ONLY for zone chips/venue-map fills, never as brand accent: `violet`, `fuchsia`, `cyan`, `amber`, `emerald`, `rose` (all Tailwind `-500`).

- High contrast: WCAG AA minimum (4.5:1 body text on background). The gold ramp is tuned to clear AA on charcoal — trust the tokens.
- **Signature treatments** (recreate as SVG/CSS in Remotion, NOT the app's CSS classes — see §4): gold foil gradient (`linear-gradient(115deg, gold → gold-deep)`), gold hairline rule fading to transparent at both ends, low-opacity film grain overlay (~5%, `mix-blend overlay`), soft gold glow (`box-shadow: 0 0 30px -8px gold/50%`).

### Typography (source of truth: `globals.css` `@theme`)
The app ships three real families — all available on Google Fonts, so load them via `@remotion/google-fonts` (§7), never system fallbacks:

| Role | Font | In the app | Use in video for |
|------|------|-----------|------------------|
| **Display** | **Anton** (`--font-display`) | `.text-display`: uppercase, `letter-spacing: 0.01em`, `line-height: 0.95` | Headlines, hooks, big statements |
| **Voice** | **Cormorant** (`--font-serif`) | `.text-voice`: italic, weight 500 | Atmospheric one-liners, invitations |
| **Sans** | **Geist Sans** (`--font-sans`) | body, UI | Supporting copy, labels, numbers |
| **Mono** | **Geist Mono** (`--font-mono`) | codes | Table codes (`VIP-04`), order codes |

- **Label style** (`.label-luxe`): uppercase, `letter-spacing: 0.14em`, ~11px in-app — scale up for video; use sparingly for data labels, not as an eyebrow on every scene.
- **Video text minimums** (1080-wide comp; scale up for 1920): headline ≥ 84px, supporting ≥ 44px, labels ≥ 32px (per Remotion video-layout rules — see §4). At-a-glance readability beats fitting more words.
- No raw emoji; use `lucide-react` icons or the app's `BottleIcon`.

### Branding Assets
- **Logo:** `public/brand/n-mark.png` (the N-mark) + wordmark "NightLife" with "Next" in gold gradient — mirror `src/components/shared/brand-logo.tsx`. Copy `n-mark.png` into the Remotion project's `public/` and load via `staticFile()`.
- **Icons:** `lucide-react` (`QrCode`, `Wine`, `ShoppingCart`, `Bell`, `CheckCircle2`, `LayoutGrid`) or `BottleIcon` from the app.
- **QR placeholder:** render a realistic QR grid; if it should scan, point it at the demo URL (`NEXT_PUBLIC_DEMO_URL`).
- **Do not:** hardcode real venue or staff names beyond the demo seed's generics (`Velvet MTL`, French-Canadian first names). No real customer data.

---

## 3. Video Templates & Scenarios

Each scenario below targets a specific audience or feature angle. AI agents should choose the most relevant scenario and adapt copy/pacing as needed. Prioritize the **Tier 1** clips first (highest impact, most general).

### Tier 1 — Core Product Stories (Universal, High-Impact)

#### **1.1 Guest Ordering Flow** (10–13 sec)
**For:** Guests, venue partners, social media / paid ads

**Hook:** "Scan. Order. Enjoy." (text overlay or voiceover)

**Sequence:**
1. **Intro (0–1s):** Fade in dark background; show animated QR code scanning from phone (Lucide QR icon)
2. **Join (1–3s):** iPhone frame of guest joining table; name entry with smooth typing animation; "Marc-Antoine" appears
3. **Menu (3–6s):** iPhone showing menu categories (Vodka, Champagne, Whisky) with parallax scroll; tap one category, bottles appear with prices
4. **Cart & Order (6–9s):** Quick cuts: add item (cart badge increments), cart page totaling, "Place Order" button animation
5. **Confirmation (9–11s):** ✓ check mark animation; "Order placed" toast notification; timer showing "EST. 3 min"
6. **CTA (11–13s):** Fade out; text overlay: "NightLife — Order Direct From Your Table" + logo + QR to demo app

**Visual Cues:**
- Smooth slide transitions between app screens
- Accent color (orange/red) for buttons and badges
- Bottle icons appear with each item added
- Music: upbeat, modern, 120–130 BPM (license-free electronic or lounge)

**Copy (optional voiceover):**
- "No lines, no waits. Open the menu with your phone."
- "Add what you want, send it to the bar."
- "Your order arrives in minutes."

---

#### **1.2 Floor Manager Command Center** (12–15 sec)
**For:** Venue operators, LinkedIn, B2B decision-makers

**Hook:** "See Everything. Control Everything." (text overlay)

**Sequence:**
1. **Intro (0–1s):** Fade in dark background; show animated floor map grid (Lucide Grid3x3 or custom)
2. **Dashboard Overview (1–4s):** Laptop/desktop UI showing manager dashboard; camera zoom-in on key metrics: revenue, active tables, order flow
3. **Tables Snapshot (4–7s):** Animated floor map with color-coded table status (open/occupied/reserved); cursor pointing, zones highlighting
4. **Orders Pulse (7–10s):** Orders queue animating (pending → accepted → preparing → ready); numbers ticking up
5. **Analytics Peek (10–12s):** Quick cut to analytics chart (revenue trend, guest happiness, average order value)
6. **CTA (12–15s):** Text overlay: "Manage Your Night in Real-Time" + logo + QR + tagline

**Visual Cues:**
- Neutral/grayscale base colors with accent color highlighting active zones
- Animated number counters (e.g., +15 orders this hour)
- Smooth map pans and zone fills
- Music: professional, moderate pace, 100–115 BPM (modern orchestral or ambient electronic)

**Copy (optional voiceover):**
- "See all your tables at a glance."
- "Orders flow in. Staff keeps up."
- "Your night, optimized."

---

#### **1.3 Staff Coordination** (11–14 sec)
**For:** Bartenders, runners, staff recruitment, internal comms

**Hook:** "Teamwork at The Speed of Service." (text overlay)

**Sequence:**
1. **Intro (0–1s):** Montage of people icon / staff badge; dark background
2. **Order Alert (1–3s):** Staff phone showing order notification; bell/alert animation; order details appear (table, items, priority)
3. **Claiming (3–5s):** Button animation: "Claim" → check mark; staff name appears on order (e.g., "Claimed by Nina")
4. **Execution (5–8s):** Quick cuts: order progresses (pending → accepted → preparing → ready); checkmarks lighting up; timer ticking
5. **Collaboration (8–11s):** Chat bubble appearing (staff messaging); two avatars; message: "Table VIP-04 wants extra lime" → quick reply
6. **CTA (11–14s):** Text overlay: "Work Smarter, Not Harder" + logo + tagline

**Visual Cues:**
- Mobile-first (show staff phone interface)
- Real-time status updates with smooth animations
- Avatar colors for staff differentiation (derived from zone colors)
- Music: upbeat, collaborative vibe, 110–125 BPM

---

### Tier 2 — Feature Highlights (Specific Audiences, Mid-Impact)

#### **2.1 Reservation & Event Management** (12–15 sec)
**For:** Event planners, corporate clients, venue booking partners

**Hook:** "Reservations Made Simple." (text overlay)

**Sequence:**
1. **Intro (0–1s):** Calendar icon animation; date highlighting
2. **Booking (1–4s):** Admin/manager form for creating reservation; name, party size, zone selection animate in
3. **Floor Picker (4–7s):** Floor map appears; user tapping zones or specific tables; zone colors respond
4. **Confirmation (7–10s):** Reservation card appears with all details (date, time, party size, zone, special notes)
5. **QR/Link (10–12s):** Share button animation; QR code generated; link copied confirmation
6. **CTA (12–15s):** Text overlay: "Reserve Your Perfect Night" + logo

**Copy:** "Create, assign, confirm, and share—all in seconds."

---

#### **2.2 Happy Hour & Promotions** (10–12 sec)
**For:** Marketing, social media, venue owners

**Hook:** "Amplify Your Specials." (text overlay)

**Sequence:**
1. **Intro (0–1s):** Animated discount badge / percentage icon
2. **Create (1–3s):** Manager interface: setting happy hour (time, discount %, items)
3. **Display (3–6s):** Guest menu refreshing; discounted items highlighted (e.g., "Vodka Soda — ~~$15~~ $10" with strikethrough animation)
4. **Uptake (6–9s):** Order tally animating (5 → 12 → 28 orders placed during happy hour)
5. **Results (9–11s):** Revenue or margin stat appearing (e.g., "+$800 revenue")
6. **CTA (11–13s):** "Maximize Your Margins" + logo

---

#### **2.3 Analytics & Insights** (13–15 sec)
**For:** Data-driven operators, enterprise prospects

**Hook:** "Data-Driven Nights." (text overlay)

**Sequence:**
1. **Intro (0–1s):** Chart icon animation
2. **Metrics (1–4s):** Multiple KPI cards appearing (revenue, guest count, avg. order value, repeat customers)
3. **Trends (4–8s):** Animated line chart showing nightly revenue over a week; trend arrow going up
4. **Segmentation (8–11s):** Pie chart or heatmap showing top-selling items, peak hours, zone performance
5. **Export (11–13s):** Report card or CSV icon; data flowing out
6. **CTA (13–15s):** "Grow With Confidence" + logo

---

### Tier 3 — Niche Features (Specific Use Cases, Lower Volume)

#### **3.1 Floor Map & Table Management** (11–14 sec)
**For:** Venue managers, layout designers, large venues

**Hook:** "Design Your Perfect Venue Layout." (text overlay)

**Sequence:**
1. **Intro (0–1s):** Grid/floor plan icon
2. **Canvas (1–3s):** Blank floor map appearing
3. **Zones (3–6s):** Zone creation; colored boxes appearing (Main Floor, VIP Mezzanine, Terrace, Back Bar); zone names labeling
4. **Tables (6–9s):** Tables being added to zones; drag-and-drop animation; numbers appearing (VIP-01, VIP-02, etc.)
5. **Settings (9–11s):** Capacity/min-spend icons showing on tables; quick customization
6. **Live View (11–13s):** Map shifting to live mode; real-time table status (occupied, open, reserved) with color fills
7. **CTA (13–15s):** "Manage Every Inch" + logo

---

#### **3.2 QR Code Generation & Tracking** (10–13 sec)
**For:** Tech-savvy operators, white-label partners, tech blogs

**Hook:** "One Scan, Infinite Possibilities." (text overlay)

**Sequence:**
1. **Intro (0–1s):** QR icon / scanning animation
2. **Gen (1–3s):** QR codes generating for multiple tables; code details appearing (table ID, URL, timestamp)
3. **Scan (3–6s):** iPhone camera viewfinder; QR code appearing in frame; success animation (checkmark)
4. **Join (6–9s):** Landing page loading (guest join flow); name entry
5. **Session (9–11s):** Bar code on physical receipt/order; tracking number appearing
6. **CTA (11–13s):** "Track Every Tab. Every Guest." + logo

---

## 4. Animation & Motion Principles

### Pacing
- **Intro (0–2s):** Bold, eye-catching; establish the scenario
- **Build (2–8s):** Introduce features with smooth transitions; let each element breathe (0.3–0.8s transitions)
- **Climax (8–12s):** Combine elements; show the payoff or result
- **CTA (12–15s):** Settle into call-to-action; logo + tagline

### How motion works in Remotion (read this before writing any animation)
Remotion renders **deterministically per frame** — there is no wall clock. **CSS transitions/animations and Tailwind `animate-*`/`transition-*` classes are FORBIDDEN; they will not render.** Animate every property from `useCurrentFrame()` + `interpolate()` (see §7). For scene-to-scene cuts use `<TransitionSeries>` from `@remotion/transitions` (`fade()`, `slide({direction})`, `wipe()`), not the app's keyframes.

### Match the app's motion signature (recreate these curves via `Easing.bezier`)
The app's `globals.css` defines the house feel — reuse the exact béziers so video and product move alike:

| App treatment | Bézier | Video use |
|---------------|--------|-----------|
| `fade-up` (entrances) | `Easing.bezier(0.16, 1, 0.3, 1)` | Headlines, cards sliding up + fading in |
| `pop-in` (confirmations) | `Easing.bezier(0.34, 1.56, 0.64, 1)` (overshoot) | Checkmarks, badges, "Order placed" |
| `hover-lift` / premium | `Easing.bezier(0.4, 0, 0.2, 1)` | Emphasis lifts, gold-glow reveals |

- **Speed:** 8–12 frames (~0.3s) for UI responses; 18–30 frames (~0.6–1s) for scene changes and headline entrances.
- **Avoid:** flip/spin/explode novelty. The brand reads as luxe, not hype.

### Emphasis (Remotion-native)
- Gold glow bloom on the one focal element per scene (animate `box-shadow` spread via `interpolate`).
- Scale/translate lift on the hero card (use `scale`/`translate` shorthands, not `transform` strings — keeps Studio keyframes editable).
- Number counters (0 → N) via `interpolate(frame, [a,b], [0, N])` + `Math.round`, rendered `tabular-nums`.
- Pop-in checkmarks/badges for confirmations (the overshoot bézier above).
- Film-grain overlay + a single slow gold glow-pulse as ambient atmosphere — venue lighting, not a screensaver.

### Frame safety & layout (per Remotion video-layout rules)
- One main message per scene; let time solve crowding — reveal features sequentially, never a dashboard of widgets.
- Safe area: keep key text ≥ 80px from the sides and ≥ 100px top/bottom on a 1080-wide frame (scale up for 1920/mobile). Mobile 9:16 must survive platform UI chrome (top/bottom ~15%).
- Put readable content in `flex`/`grid` slots; reserve absolute positioning for backgrounds, glows, and grain.

### Music & Sound
- **Royalty-free sources:** Epidemic Sound, Artlist, YouTube Audio Library, Pixabay Music
- **Tempo:** 100–130 BPM (matches energy of the clip)
- **Mood:**
  - **Tier 1 clips:** Modern, upbeat, confident (lounge electronic, modern indie)
  - **Tier 2 clips:** Dynamic, energetic (electronic, modern pop)
  - **Tier 3 clips:** Professional, sophisticated (ambient, minimalist)
- **Duration:** Match video length; fade out in last 1–2 seconds
- **No voiceover overlays required,** but if added:
  - Professional, conversational tone
  - Clear diction; match music pacing
  - Captions burn-in or provide `.srt` for accessibility

---

## 5. Copy & Messaging Templates

### Hooks (0–2s)
- "Scan. Order. Enjoy."
- "See Everything. Control Everything."
- "Teamwork at The Speed of Service."
- "Reservations Made Simple."
- "Amplify Your Specials."
- "Data-Driven Nights."

### Problem Statements (Implied or Stated)
- Long lines, slow service, paper tickets lost
- Scattered orders, miscommunication, bottlenecks
- No visibility into venue performance
- Manual scheduling and no-shows
- Lost upsell opportunities

### Solution Statements (CTAs)
- "Order direct from your table."
- "See all your tables at a glance."
- "Claim and execute, together."
- "Your night, optimized."
- "Grow with confidence."
- "Manage every tab, every guest."

### Tagline (Consistent Across All)
- **Primary:** "NightLife — The Venue Operating System"
- **Secondary:** "Nightclub Ops Simplified."
- **Short:** "Where great nights are made."

### Call-to-Action (Ending)
- "Watch the demo at [DEMO_URL]"
- "Join the community at [MARKETING_URL]"
- "Request a walkthrough: [CONTACT_EMAIL]"
- "Download the app: [APP_STORE_LINKS]"
- *Or* just logo + tagline (no explicit ask)

---

## 6. Content & Data Guidelines

### What to Show
- ✅ Generic, realistic venue data (French-Canadian names: Marc-Antoine, Chloé, Nina)
- ✅ Realistic UI states from actual app (screenshots → recreate in Remotion)
- ✅ Example zones (Main Floor, VIP Mezzanine, Terrace, Back Bar)
- ✅ Example items (bottle names, pricing, realistic order numbers)
- ✅ Real app workflows (QR → join → menu → order → delivery)
- ✅ Accessible color contrasts and readable text

### What NOT to Show
- ❌ Real customer data, real staff names, real email addresses
- ❌ Live app URLs (use `nightlifenext.app` or `[DEMO_URL]` placeholder)
- ❌ Specific third-party logos (Stripe, Prisma, etc.) unless necessary
- ❌ Errors, broken states, or loading spinners (exception: intentional "loading" to show responsiveness)
- ❌ Hardcoded test data (e.g., "Test User", "Fake Venue"); use naturalistic examples
- ❌ Footage from any real venue or third-party without permission

### Realistic Metrics
Use these ranges for stats/numbers:

| Metric | Range | Example |
|--------|-------|---------|
| Revenue (per night) | $2K–$15K | $8,500 |
| Active tables | 3–20 | 12 tables |
| Avg order value | $30–$80 | $52 |
| Orders/hour | 5–40 | 18 orders |
| Guest count | 5–200 | 87 guests |
| Repeat rate | 10–40% | 28% |

---

## 7. Remotion Implementation Guide

### Composition Structure
One file per scenario (no version suffix — version via the git history and the `Root.tsx` `id`, e.g. register `guest-ordering-landscape` and `guest-ordering-mobile` from the same component). Each file exports only its component; `Root.tsx` owns the `<Composition>` registrations and dimensions (see `REMOTION-SETUP.md §6`).

```
promo-video/src/compositions/
├── GuestOrderingFlow.tsx     (Tier 1.1)
├── ManagerDashboard.tsx      (Tier 1.2)
├── StaffCoordination.tsx     (Tier 1.3)
├── ReservationMgmt.tsx       (Tier 2.1)
├── HappyHourPromo.tsx        (Tier 2.2)
├── Analytics.tsx             (Tier 2.3)
└── ...
```

### Technical Stack
- **Framework:** Remotion, in its **own project** scaffolded with `npx create-video` (see `REMOTION-SETUP.md`). It is NOT wired into the Next.js app — it imports data/tokens from it but renders standalone.
- **React:** functional components. State that varies over time comes from `useCurrentFrame()`, not `useState`.
- **Styling:** inline `style` objects (recommended for editable Studio keyframes) or Tailwind (`className`) if Tailwind is enabled in the Remotion project — but **never `animate-*`/`transition-*` classes**.
- **Icons:** `lucide-react`.
- **Fonts:** `@remotion/google-fonts/Anton`, `/Cormorant`, `/Geist` (`loadFont()` blocks render until ready). Never rely on system fonts.
- **Data:** import realistic shapes from the app's `src/lib/mock-data/` where practical, or copy a small seed JSON into the Remotion project. Reuse the demo's French-Canadian names.
- **Transitions:** `interpolate()` for property animation; `<TransitionSeries>` for scene cuts.

### Key APIs (verified)
- `useCurrentFrame()` — the current frame; the root of all animation.
- `useVideoConfig()` — `{ fps, durationInFrames, width, height }`.
- `interpolate(frame, [inFrames], [outValues], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing })` — map frame → value. Keep it **inline in the `style` prop**.
- `Easing.bezier(...)` — custom timing (use the app's curves from §4).
- `<AbsoluteFill>` — full-bleed layer (background, glow, grain).
- `<Sequence from={} durationInFrames={} layout="none">` — delay/limit a child. `layout="none"` for inline content (otherwise a Sequence is an absolute fill).
- `<TransitionSeries>` + `@remotion/transitions` — scene-to-scene fades/slides/wipes. Note transitions **shorten** total duration (overlapping scenes).
- `staticFile("brand/n-mark.png")` — reference anything in the Remotion project's `public/`.
- `<Img>` for images; `<Audio>`/`<Video>` from `@remotion/media` for audio/video.
- Prefer `scale`/`translate`/`rotate` CSS shorthands over `transform` strings (keeps keyframes visible/editable in Studio).

### Example: correct button-emphasis animation
```tsx
import { useCurrentFrame, interpolate, Easing, Sequence } from "remotion";
import { BRAND } from "./brand"; // exact OKLCH tokens copied from globals.css

const PlaceOrderButton: React.FC = () => {
  const frame = useCurrentFrame();
  // Overshoot "pop" using the app's pop-in bézier
  const scale = interpolate(frame, [0, 18], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const glow = interpolate(frame, [0, 18], [0, 30], { extrapolateRight: "clamp" });
  return (
    <button
      style={{
        scale,
        background: `linear-gradient(115deg, ${BRAND.goldBright}, ${BRAND.gold} 55%, ${BRAND.goldDeep})`,
        color: BRAND.charcoalInk,
        padding: "18px 40px",
        borderRadius: 14,
        fontSize: 44,
        boxShadow: `0 0 ${glow}px -8px ${BRAND.gold}`,
      }}
    >
      Place order
    </button>
  );
};

// Delay it 10 frames into the scene:
<Sequence from={10} layout="none">
  <PlaceOrderButton />
</Sequence>
```

### Asset Management
- **Everything referenced at render time lives in the Remotion project's `public/`** and is loaded via `staticFile()` — images, audio, fonts-as-files.
- **Logo:** copy `public/brand/n-mark.png` from the app into the Remotion `public/brand/`.
- **PNGs/JPGs:** optimize before use; `<Img>` with explicit width/height.
- **Add packages** with `npx remotion add <pkg>` (picks the version-matched release) — e.g. `@remotion/media`, `@remotion/transitions`, `@remotion/google-fonts`, `zod`.

### Rendering & Testing
- **Studio (preview):** `npx remotion studio --no-open` (long-running; prints the URL).
- **One-frame sanity check:** `npx remotion still <composition-id> --frame=30 --scale=0.25` (frame 30 = the 1-second mark at 30fps).
- **Full render:** `npx remotion render <composition-id> out/<name>.mp4 --concurrency 4`.
- Codec/quality flags: see `npx remotion render --help`. Target 6–8 Mbps at 1080p (§1).

---

## 8. Quality Checklist

Before shipping a promotional video, verify:

### Visual
- [ ] Text is readable at all times (18px minimum at 1080p)
- [ ] Colors meet WCAG AA contrast (4.5:1 text on background)
- [ ] No jarring transitions or flicker
- [ ] Animations are smooth (no dropped frames at 30fps)
- [ ] Logo is clearly visible and on-brand
- [ ] Aspect ratios match intended platforms (landscape, mobile, square)

### Audio
- [ ] Music volume is consistent (peaks near -3dB)
- [ ] No copyright claims or licensing issues (confirmed royalty-free)
- [ ] Captions/SRT file provided (even if not burned-in)
- [ ] Audio fades out cleanly in last 1–2 seconds

### Content
- [ ] No real customer names, emails, or sensitive data
- [ ] No hardcoded URLs (use placeholders if needed)
- [ ] Realistic data ranges (revenue, order counts, etc.)
- [ ] Call-to-action is clear and actionable
- [ ] Branding consistent (logo, colors, tagline)

### Metadata
- [ ] File named correctly: `<role>-<feature>-<date>-<version>.mp4`
- [ ] Duration is 10–15 seconds (hard cap: 16s)
- [ ] Resolution and frame rate match spec (1080p @ 30fps for landscape, etc.)
- [ ] File size is reasonable (< 50MB)

### Accessibility
- [ ] Captions provided (`.srt` file)
- [ ] No flashing or strobing (seizure risk)
- [ ] Color not the only means of conveying information (use labels + icons)
- [ ] Alternative text description available for the platform (LinkedIn, YouTube, etc.)

---

## 9. Iteration & Versioning

### Version Naming
- **V1:** First draft (test edits, timing, flow)
- **V2:** First feedback round (messaging adjustments, pacing tightens)
- **V3+:** Refinements (music swaps, color tweaks, re-renders)

### Feedback Loop
1. **Render local preview** (low res, fast render)
2. **Review with stakeholders** (timing, messaging, vibe fit)
3. **Collect feedback** (what lands, what falls flat)
4. **Iterate** (adjust script, timing, assets)
5. **High-quality render** (final bitrate, codec, optimization)
6. **Publish** (drive platforms, landing pages, email)

### Storage & Archiving
- Keep source compositions in the `promo-video/` Remotion project (checked into repo)
- Archive rendered videos to a CDN or shared drive (not in git)
- Document known issues or platform-specific adaptations in a `RENDER_LOG.md`

---

## 10. AI Agent Instructions

**When generating a promotional video using this spec, follow these steps:**

1. **Choose a scenario** from §3 (Tier 1 recommended for first pass)
2. **Confirm aspect ratio** with stakeholder (landscape default; mobile if targeting Stories/Reels)
3. **Gather assets:**
   - App screenshots for reference (from `promo-screenshots.ts` output or live demo)
   - Brand colors, logos, fonts (from design system)
   - Royalty-free music track (verified license)
4. **Build Remotion composition:**
   - Use template structure from §7
   - Follow motion principles from §4 (pacing, transitions, emphasis)
   - Implement copy/messaging from §5
   - Reference data ranges from §6
5. **Preview & iterate:**
   - Render to preview; watch for timing/flow issues
   - Adjust transitions, text timing, music sync
   - Gather early feedback (internal team)
6. **Final render:**
   - High-bitrate render (6–8 Mbps @ 1080p)
   - Verify file size (< 50MB)
   - Generate captions (`.srt` file)
7. **Quality check:**
   - Walk through checklist in §8
   - Test on target platform (YouTube, TikTok, LinkedIn, etc.)
   - Confirm no copyright issues
8. **Deliver:**
   - Archive source composition
   - Upload rendered video to platform
   - Provide `.srt` captions and alt-text
   - Document in project (markdown note: platform, publish date, performance metrics if tracked)

---

## 11. FAQ & Troubleshooting

### Q: How do I handle responsive layouts (mobile vs. desktop in one composition)?
A: Create separate compositions for each aspect ratio. Use a factory function to generate variants:
```tsx
const createComposition = (width, height, aspectLabel) => (
  <Composition name={`GuestFlow_${aspectLabel}`} {...} />
);
createComposition(1920, 1080, "landscape");
createComposition(1080, 1920, "mobile");
```

### Q: Can I sync animations to music beats?
A: Compute beat frames from tempo — at 120 BPM and 30fps a beat lands every 15 frames (`30 / (120/60)`). Trigger scene cuts / pop-ins on those frames. For amplitude-reactive visuals (spectrum bars), see the skill's `audio-visualization.md` (`visualizeAudio`/`useAudioData`), not a made-up hook.

### Q: How do I reduce render time?
A: Use the `--concurrency` flag (`npx remotion render <id> out.mp4 --concurrency 8`). While iterating, sanity-check single frames with `npx remotion still` instead of full renders.

### Q: Should I include a voiceover?
A: Optional. If yes, record/source it first, add to Remotion's audio track, and sync animations to it. If no, rely on captions + music + visual storytelling.

### Q: Can I reuse assets across compositions?
A: Absolutely. Extract common components (e.g., `<VenueFloorMap />`, `<OrderCard />`, `<StaffAvatar />`) into a `components/` folder and import.

### Q: What if a render fails midway?
A: Check logs (`--log=verbose` flag). Common causes: missing font, asset path error, memory limit. Troubleshoot by rendering a shorter `durationInFrames` first, then full.

### Q: How do I ensure the video doesn't get copyright-claimed on YouTube?
A: Use only royalty-free, licensed music. Verify via the source platform (Epidemic Sound, Artlist show license status). Provide music attribution in description or credits.

---

## 12. Resources & References

### Design System (source of truth)
- Colors + motion: [`src/app/globals.css`](src/app/globals.css) — the Ember/champagne-gold OKLCH tokens and the `fade-up`/`pop-in`/`glow-pulse` keyframes to mirror.
- Zone/data colors: [`src/lib/zone-colors.ts`](src/lib/zone-colors.ts).
- Logo + wordmark: [`src/components/shared/brand-logo.tsx`](src/components/shared/brand-logo.tsx), asset at `public/brand/n-mark.png`.
- Fonts: Anton (`--font-display`), Cormorant (`--font-serif`), Geist Sans/Mono — all on Google Fonts.

### Existing Assets
- Screenshots: `promo-output/` (from `scripts/promo-screenshots.ts` — drives the real live app)
- Mock data: `src/lib/mock-data/` (realistic French-Canadian names, venue details)
- Icons: `lucide-react` + the app's `BottleIcon`

### Remotion Docs
- [Remotion API Reference](https://www.remotion.dev/docs)
- [Composition Guide](https://www.remotion.dev/docs/composition)
- [Remotion Lambda](https://www.remotion.dev/docs/lambda) (for cloud rendering at scale)

### Music & Licenses
- [Epidemic Sound](https://www.epidemicsound.com/)
- [Artlist](https://artlist.io/)
- [YouTube Audio Library](https://www.youtube.com/audiolibrary)
- [Pixabay Music](https://pixabay.com/music/)

### Accessibility
- [WCAG 2.1 Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Subtitle Best Practices](https://www.rev.com/blog/how-to-format-srt-subtitles)

---

## 13. Glossary & Terms

| Term | Definition |
|------|-----------|
| **Composition** | A Remotion React component that renders to video (e.g., `GuestFlow_V1`) |
| **Sequence** | Remotion component that limits child visibility to a time range (frames) |
| **Interpolate** | Remotion function to smoothly map frame time to animation values (0–1) |
| **BPM** | Beats per minute; music tempo (120 BPM = 2 beats/sec) |
| **Bitrate** | Video data rate; higher = better quality but larger file; 6–8 Mbps recommended for 1080p |
| **Captions/SRT** | Subtitle file (text timing format); searchable, accessible |
| **Aspect Ratio** | Width:Height proportion (16:9 landscape, 9:16 mobile, 1:1 square) |
| **Easing** | Animation curve (e.g., easeInOutCubic = slow start/end, fast middle) |
| **Thumbnail** | Still frame extracted from video for previews |

---

## Appendix: Example Copy for Social Posts

### Instagram Caption (Guest Ordering)
```
No lines. No waits. Just your phone and the menu. 📱
Scan, order, enjoy—NightLife makes ordering from your table effortless.
🍾 Download the demo and try it yourself.
Link in bio.
#NightLife #Hospitality #Venues #OrderDirect
```

### LinkedIn Post (Manager Dashboard)
```
See Everything. Control Everything.
From one dashboard, managers now have full visibility into:
• Real-time table occupancy
• Order flow and kitchen coordination
• Revenue and guest metrics
• Staff performance

The future of venue operations is here.
NightLife — The Venue Operating System™
[Learn more](#)
```

### TikTok Caption (Staff Coordination)
```
POV: You're a bartender who finally has their life together 💪
No more lost orders. No more miscommunication.
NightLife handles the chaos so you can focus on what matters: great service.
Try the demo → [link]
#BartenderLife #Hospitality #VenueOps
```

---

**Document Version:** 1.1  
**Last Updated:** 2026-07-25  
**Maintained By:** NightLife Marketing / Product Team  
**Approved By:** [Insert Stakeholder Name(s)]

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-24 | Initial spec: 8 scenarios (3 Tier 1, 3 Tier 2, 2 Tier 3), visual identity, Remotion implementation guide, quality checklist |
| 1.1 | 2026-07-25 | **Corrected against the real codebase.** Replaced invented palette with the app's Ember/champagne-gold OKLCH tokens (`globals.css`); real fonts (Anton/Cormorant/Geist); real motion curves. Fixed Remotion §4/§7: removed forbidden framer-motion + Tailwind `animate-*` patterns and the non-existent `useFrameForVolume()`; documented `useCurrentFrame()`+`interpolate()`, `TransitionSeries`, `staticFile`, `@remotion/google-fonts`. Standalone `promo-video/` project; id-based composition versioning. |
