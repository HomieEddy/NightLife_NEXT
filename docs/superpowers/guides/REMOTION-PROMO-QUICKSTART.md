# NightLife Remotion Promo Videos — Quick Start Guide

**TL;DR:** Use this guide to generate your first promotional video clip using the Remotion skill + the spec (`PROMO-VIDEO-SPEC.md`). Each video takes 4–6 hours from start to final render.

---

## Workflow at a Glance

```
1. Choose Scenario        →  2. Gather Assets        →  3. Build & Preview
        (10 min)                 (15–30 min)                (1–2 hours)
          ↓                           ↓                         ↓
4. Iterate & Refine        →  5. Final Render        →  6. QA & Deliver
    (1–2 hours)               (15–45 min)                (30 min)
```

---

## Step 1: Choose a Scenario (10 min)

**Goal:** Pick which promotional angle you want to build first.

### Decision Tree

**If you're starting from scratch:**  
→ Pick **Tier 1.1: Guest Ordering Flow** (most universally appealing, shows core product)

**If targeting venue operators:**  
→ Pick **Tier 1.2: Floor Manager Dashboard** (shows power & control)

**If recruiting/building team culture:**  
→ Pick **Tier 1.3: Staff Coordination** (shows teamwork, operational efficiency)

**If targeting specific features:**  
→ Browse Tier 2 (reservations, happy hours, analytics)

### Record Your Choice
Write down:
- **Scenario name:** e.g., "Guest Ordering Flow"
- **Tier:** 1.1 (or whichever)
- **Target aspect ratio:** Landscape (1920×1080) for web/YouTube; Mobile (1080×1920) for Reels/Stories
- **Target platform(s):** YouTube, LinkedIn, landing page, social ads, etc.
- **Key message/hook:** e.g., "Scan. Order. Enjoy." (from spec §2)

**Example:**
```
Scenario: Guest Ordering Flow (Tier 1.1)
Aspect: Landscape (1920×1080)
Platforms: YouTube, landing page, LinkedIn
Hook: "Scan. Order. Enjoy."
Target Audience: Venue owners, guests, partners
```

---

## Step 2: Gather Assets (15–30 min)

### 2.1 App Screenshots (Reference)
Run the existing promo-screenshot script to get realistic UI assets:

```bash
# Terminal 1: Start the live app with seed data
npm run dev:pglite:seed

# Terminal 2: Capture screenshots
PROMO_BASE_URL=http://localhost:3000 npx tsx scripts/promo-screenshots.ts
```

Screenshots land in `promo-output/`. These are your visual reference.

### 2.2 Music Track
1. Browse royalty-free libraries:
   - [YouTube Audio Library](https://www.youtube.com/audiolibrary) (free, no copyright strikes)
   - [Pixabay Music](https://pixabay.com/music/) (free, various genres)
   - [Epidemic Sound](https://www.epidemicsound.com/) (paid, premium catalog)

2. **Selection criteria** (from spec §4):
   - BPM: 100–130 (matches video energy)
   - Duration: 15–20 seconds (can be looped/trimmed)
   - License: Confirmed royalty-free or licensed for your use
   - Mood: Match your scenario (upbeat for Tier 1, professional for Tier 2)

3. **Save to the Remotion project's `public/music/`** (so `staticFile()` can find it):
   ```
   promo-video/public/music/
   ├── guest-ordering.mp3
   ├── manager-dashboard.mp3
   └── ...
   ```
   Keep the source/attribution note for each track (§6.3) — you'll need it for the SRT/credits.

### 2.3 Brand Colors & Fonts
These come from `src/brand.ts` in the Remotion project (created once in `REMOTION-SETUP.md §7`) — the exact Ember/champagne-gold tokens copied from the app's `globals.css`. Do not invent colors here.
- **Ground/text:** warm charcoal `BRAND.background`, ivory `BRAND.foreground`
- **Accent:** champagne gold (`BRAND.gold` / `goldBright` / `goldDeep`) — CTAs use the gold foil gradient
- **Fonts:** **Anton** (display), **Cormorant** (italic voice), **Geist** (sans) via `@remotion/google-fonts`
- **Logo:** `public/brand/n-mark.png` (copied from the app), loaded with `staticFile()`

### 2.4 Example Data
Copy realistic data from the seed:
- **Guest names:** Chloé, Marc-Antoine, Samuel, Félix (from spec §2.2 or `promo-screenshots.ts`)
- **Venue details:** Velvet MTL, zones (Main Floor, VIP Mezzanine, Terrace)
- **Menu items:** Bottles, prices (e.g., Grey Goose $45, Moët $50)
- **Metrics:** Revenue $8,500, 12 active tables, 87 guests (from spec §6)

Store in the Remotion project as `src/seed-data.ts` (typed export) — or reuse shapes directly from the app's `src/lib/mock-data/`:
```json
{
  "venue": {
    "name": "Velvet MTL",
    "timezone": "America/Toronto"
  },
  "zones": ["Main Floor", "VIP Mezzanine", "Terrace", "Back Bar"],
  "tables": [
    { "code": "VIP-01", "capacity": 4, "zone": "VIP Mezzanine" },
    { "code": "VIP-04", "capacity": 6, "zone": "VIP Mezzanine" },
    { "code": "T-07", "capacity": 2, "zone": "Terrace" }
  ],
  "guestNames": ["Marc-Antoine", "Chloé", "Samuel", "Élise", "Julien"],
  "menuItems": [
    { "name": "Grey Goose", "category": "Vodka", "price": 4500 },
    { "name": "Moët & Chandon", "category": "Champagne", "price": 5000 }
  ]
}
```

### 2.5 Checklist
- [ ] Screenshots captured (`promo-output/` folder populated)
- [ ] Music track selected and saved to `promo-video/public/music/`
- [ ] Logo/brand assets confirmed
- [ ] Example data JSON created
- [ ] Aspect ratio decided (landscape / mobile / square)

---

## Step 3: Build & Preview (1–2 hours)

### 3.1 Create a Remotion Composition File

In the Remotion project's `src/compositions/`, create **`GuestOrderingFlow.tsx`** (Tier 1.1). It is registered in `Root.tsx` (see `REMOTION-SETUP.md §6`), so the file exports only the component — not its own `<Composition>`.

This template is **brand-accurate and frame-driven**: gold-on-charcoal from `brand.ts`, real fonts, and every animation via `useCurrentFrame()` + `interpolate()` (never CSS/Tailwind transitions). A small reusable helper (`FadeUp`) does the app's `fade-up` entrance.

```tsx
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, Easing, Img, staticFile } from "remotion";
import React from "react";
import { QrCode, CheckCircle2 } from "lucide-react";
import { BRAND, fonts, EASE } from "../brand";

// App's fade-up entrance: slide up 24px + fade, over `dur` frames from `delay`.
const FadeUp: React.FC<{ delay?: number; dur?: number; children: React.ReactNode }> = ({
  delay = 0,
  dur = 18,
  children,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...EASE.fadeUp),
  });
  return (
    <div style={{ opacity: t, translate: `0px ${(1 - t) * 24}px` }}>{children}</div>
  );
};

const Scene: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: BRAND.background,
      color: BRAND.foreground,
      fontFamily: fonts.sans,
      alignItems: "center",
      justifyContent: "center",
      padding: 100, // safe area
    }}
  >
    {children}
  </AbsoluteFill>
);

// A phone-framed app card (recreate, don't screenshot, for crisp scaling).
const PhoneCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: 520,
      background: BRAND.card,
      borderRadius: 40,
      padding: 48,
      border: `1px solid ${BRAND.gold}`,
      boxShadow: `0 0 60px -20px ${BRAND.gold}`,
    }}
  >
    {children}
  </div>
);

export const GuestOrderingFlow: React.FC = () => {
  const fps = 30;

  return (
    <AbsoluteFill style={{ background: BRAND.background }}>
      {/* 0–2s — Hook */}
      <Sequence durationInFrames={2 * fps}>
        <Scene>
          <FadeUp>
            <div
              style={{
                fontFamily: fonts.display,
                textTransform: "uppercase",
                fontSize: 120,
                lineHeight: 0.95,
                letterSpacing: "0.01em",
                textAlign: "center",
              }}
            >
              <span style={{ color: BRAND.gold }}>Scan.</span> Order. Enjoy.
            </div>
          </FadeUp>
        </Scene>
      </Sequence>

      {/* 2–4s — Join the table */}
      <Sequence from={2 * fps} durationInFrames={2 * fps}>
        <Scene>
          <FadeUp>
            <PhoneCard>
              <QrCode size={72} color={BRAND.gold} style={{ display: "block", margin: "0 auto 24px" }} />
              <div style={{ fontFamily: fonts.display, textTransform: "uppercase", fontSize: 44, textAlign: "center" }}>
                Join the table
              </div>
              <div
                style={{
                  marginTop: 28,
                  padding: "18px 20px",
                  borderRadius: 14,
                  border: `1px solid ${BRAND.mutedFg}`,
                  fontSize: 34,
                  color: BRAND.foreground,
                }}
              >
                Marc-Antoine
              </div>
            </PhoneCard>
          </FadeUp>
        </Scene>
      </Sequence>

      {/* 4–7s — Menu categories (staggered) */}
      <Sequence from={4 * fps} durationInFrames={3 * fps}>
        <Scene>
          <PhoneCard>
            <div style={{ fontFamily: fonts.display, textTransform: "uppercase", fontSize: 40, marginBottom: 28 }}>
              Browse the menu
            </div>
            {["Vodka", "Champagne", "Whisky"].map((cat, i) => (
              <FadeUp key={cat} delay={i * 6}>
                <div
                  style={{
                    marginBottom: 16,
                    padding: "20px 24px",
                    borderRadius: 14,
                    background: `oklch(0.24 0.025 55)`,
                    fontSize: 34,
                  }}
                >
                  {cat}
                </div>
              </FadeUp>
            ))}
          </PhoneCard>
        </Scene>
      </Sequence>

      {/* 7–9s — Order total + gold foil CTA */}
      <Sequence from={7 * fps} durationInFrames={2 * fps}>
        <Scene>
          <FadeUp>
            <PhoneCard>
              <div style={{ fontFamily: fonts.display, textTransform: "uppercase", fontSize: 40, marginBottom: 24 }}>
                Your order
              </div>
              {[["Grey Goose", "$45"], ["Moët & Chandon", "$50"]].map(([name, price]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 32, marginBottom: 14 }}>
                  <span>{name}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{price}</span>
                </div>
              ))}
              <div
                style={{
                  marginTop: 28,
                  padding: "18px 40px",
                  borderRadius: 14,
                  textAlign: "center",
                  fontSize: 36,
                  background: `linear-gradient(115deg, ${BRAND.goldBright}, ${BRAND.gold} 55%, ${BRAND.goldDeep})`,
                  color: BRAND.charcoalInk,
                  fontWeight: 600,
                }}
              >
                Place order · $95
              </div>
            </PhoneCard>
          </FadeUp>
        </Scene>
      </Sequence>

      {/* 9–11s — Confirmation (overshoot pop-in) */}
      <Sequence from={9 * fps} durationInFrames={2 * fps}>
        <ConfirmScene />
      </Sequence>

      {/* 11–13s — CTA + logo */}
      <Sequence from={11 * fps} durationInFrames={2 * fps}>
        <Scene>
          <FadeUp>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
              <Img src={staticFile("brand/n-mark.png")} style={{ width: 96, height: 96, borderRadius: 20 }} />
              <div style={{ fontFamily: fonts.display, textTransform: "uppercase", fontSize: 72 }}>
                NightLife<span style={{ color: BRAND.gold }}>Next</span>
              </div>
              <div style={{ fontFamily: fonts.voice, fontStyle: "italic", fontSize: 40, color: BRAND.mutedFg }}>
                Order direct from your table
              </div>
            </div>
          </FadeUp>
        </Scene>
      </Sequence>
    </AbsoluteFill>
  );
};

const ConfirmScene: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 18], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...EASE.popIn), // overshoot
  });
  return (
    <Scene>
      <div style={{ textAlign: "center" }}>
        <div style={{ scale: String(scale) }}>
          <CheckCircle2 size={160} color={BRAND.gold} />
        </div>
        <div style={{ fontFamily: fonts.display, textTransform: "uppercase", fontSize: 64, marginTop: 24 }}>
          Order placed
        </div>
        <div style={{ fontFamily: fonts.voice, fontStyle: "italic", fontSize: 40, color: BRAND.mutedFg }}>
          Arriving in ~3 minutes
        </div>
      </div>
    </Scene>
  );
};
```

> Text sizes here follow the video-layout minimums (headline ≥ 84px, supporting ≥ 44px on a 1080-tall frame). On the 1920×1080 landscape variant they read comfortably; if you build a 1080×1920 mobile cut, they already clear the bar.

### 3.2 Preview in Remotion Studio

```bash
# From the promo-video/ project — long-running; prints a localhost URL
npx remotion studio --no-open

# Your compositions appear in the left panel (guest-ordering-landscape, …)
```

Watch the video play. Note:
- Timing (does each scene feel right?)
- Text readability
- Transitions (too fast/slow?)
- Color contrast

### 3.3 Refine

Make adjustments:
- **Timing off?** Change `durationInFrames` in `<Sequence>` tags
- **Text too small?** Adjust `text-6xl` to `text-7xl` (Tailwind scale)
- **Transitions jerky?** Add easing or increase duration
- **Colors not popping?** Tweak accent color or add glow effects

Re-preview after each change (Remotion hot-reloads).

### 3.4 Add Audio (Optional)

Put the track in the Remotion project's `public/music/`, reference it with `staticFile()`, and use `<Audio>` from `@remotion/media`:

```tsx
import { Audio } from "@remotion/media";
import { staticFile } from "remotion";

// Place at the top level of the composition (a bare <Audio>, not inside a delayed Sequence,
// so it plays for the whole clip). Fade out the last ~1s with the `volume` callback:
<Audio
  src={staticFile("music/guest-ordering.mp3")}
  volume={(f) => interpolate(f, [11 * 30, 13 * 30], [1, 0], { extrapolateLeft: "clamp" })}
/>
```

**Notes:**
- Trim the track to length in an audio editor, or use `@remotion/media`'s trim props (`trimBefore`/`trimAfter`).
- For beat-synced cuts, compute beat frames from tempo: at 120 BPM / 30fps a beat is every 15 frames.

---

## Step 4: Iterate & Refine (1–2 hours)

### Early Feedback Loop
1. **Watch locally** (preview tab in Remotion)
2. **Get feedback** (internal team, 5–10 people max)
   - Does the hook land?
   - Are the transitions smooth?
   - Is the messaging clear?
   - Does it match the brand?
3. **Adjust** based on feedback:
   - Re-order scenes
   - Shorten/extend transitions
   - Tweak copy or colors
4. **Re-preview** and repeat

### Common Tweaks
| Issue | Solution |
|-------|----------|
| Transitions are choppy | Increase `durationInFrames` by 50%; smooth transitions take time |
| Text is hard to read | Add a semi-transparent background behind text; increase font size |
| Scene changes feel abrupt | Add a fade transition (0.5s black fade between scenes) |
| Timing doesn't match music | Count beats in music; align scene changes to downbeats |
| Color feels flat | Add gradient background or a glow effect on key elements |

### Version Notes
Keep track: `V1 (initial), V1.1 (faster pacing), V1.2 (updated CTA)`, etc.

---

## Step 5: Final Render (15–45 min)

### 5.1 Render Command

Render by **composition id** (from `Root.tsx`). Dimensions come from the registered composition — no need to pass width/height:

```bash
npx remotion render guest-ordering-landscape out/guest-ordering-v1.mp4 --concurrency 8
```

### 5.2 Quality Settings
For 1080p @ 30fps, Remotion's default H.264 output is fine. To tune, see `npx remotion render --help` (e.g. `--crf` for quality/size trade-off — lower CRF = higher quality, larger file).

Check file size:
- **Expected:** 15–30 MB for 13 seconds @ 1080p
- **Too large?** Raise `--crf` (e.g. `--crf 23`) or lower the target bitrate.

### 5.3 Output
```
promo-video/out/guest-ordering-v1.mp4
```

---

## Step 6: QA & Deliver (30 min)

### 6.1 Quality Checklist (from spec §8)

**Visual:**
- [ ] Text readable at all sizes
- [ ] Colors meet WCAG AA contrast
- [ ] No jarring transitions
- [ ] Logo clearly visible
- [ ] Aspect ratio correct

**Audio:**
- [ ] Music volume consistent
- [ ] No copyright claims (verified license)
- [ ] Captions provided (`.srt` file)

**Content:**
- [ ] No real names or sensitive data
- [ ] Realistic data ranges
- [ ] Clear CTA
- [ ] Branding consistent

### 6.2 Test on Target Platform
- **YouTube:** Upload as unlisted; check playback, aspect, title/description
- **LinkedIn:** Test preview card and mobile view
- **Email:** Embed in test email; confirm play on desktop/mobile

### 6.3 Generate Captions (SRT)

Create a `.srt` file with timing for each scene:

**`guest-ordering-flow-v1.srt`:**
```
1
00:00:00,000 --> 00:00:02,000
Scan. Order. Enjoy.

2
00:00:02,000 --> 00:00:04,000
Enter your name and join your table

3
00:00:04,000 --> 00:00:07,000
Browse categories and select your favorite bottles

4
00:00:07,000 --> 00:00:10,000
Add to cart and place your order

5
00:00:10,000 --> 00:00:12,000
Your order is placed and ready in minutes

6
00:00:12,000 --> 00:00:14,000
NightLife — Order Direct From Your Table
```

Upload captions to YouTube, LinkedIn, etc.

### 6.4 File Naming & Archive

```
promo-output/
├── guest-ordering-flow-v1.mp4        (final video)
├── guest-ordering-flow-v1.srt        (captions)
└── metadata.json                      (platform details)
```

**metadata.json example:**
```json
{
  "title": "NightLife Guest Ordering Flow",
  "description": "Scan, order, enjoy. See how guests place orders directly from their table in seconds.",
  "platforms": ["YouTube", "LinkedIn", "Landing Page"],
  "duration_seconds": 13,
  "aspect_ratio": "16:9",
  "music_credit": "YouTube Audio Library — [Track Name]",
  "publish_date": "2026-07-24"
}
```

### 6.5 Publish

**YouTube:**
```
Title: NightLife — Guest Ordering Flow (10 sec demo)
Description: Scan your table's QR code, browse the menu, and order directly from your phone. 📱 
Watch the full demo: [LINK]
Music: YouTube Audio Library
```

**LinkedIn:**
```
Caption: No lines. No waits. Just your phone and the menu. 📱
[Video preview]
Learn how NightLife simplifies venue operations → [LINK]
```

---

## Step 7: Iterate for Other Scenarios

Once you've built one video:

1. **Duplicate the composition** (e.g., copy `GuestOrderingFlow.tsx` → `ManagerDashboard.tsx`) and register it in `Root.tsx`
2. **Adapt the content** (follow the scenario template from spec §3)
3. **Re-preview & refine** (same loop as Steps 3–6)
4. **Render** when ready

**Tip:** Tier 1 scenarios (3 total) give you the most mileage; build all three first.

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Render fails with "module not found" | Missing font/asset import | Check paths; assets load via `staticFile()` from the project's `public/` |
| Video looks pixelated | Frame rate mismatch | Ensure `fps={30}` in composition, render command matches |
| Audio out of sync | Audio file too long/short | Trim audio to match `durationInFrames`; re-export as MP3 |
| Text hard to read | Low contrast | Add background box or shadow behind text; increase font size by 10–15% |
| Render takes > 10 minutes | High bitrate or large resolution | Reduce `--concurrency` if memory-limited; or use `--quality medium` |
| Preview doesn't update | Cache issue | Close and restart `npx remotion studio --no-open` |

---

## Next Steps

1. **Pick your first scenario** (recommended: Tier 1.1 Guest Ordering)
2. **Follow Steps 1–6** to create and publish
3. **Gather feedback** from team/stakeholders
4. **Build remaining Tier 1 scenarios** (1.2 Manager Dashboard, 1.3 Staff Coordination)
5. **Expand to Tier 2** as needed (feature-specific angles)
6. **Archive and document** in `RENDER_LOG.md`

---

## Resources

- **Remotion Docs:** https://www.remotion.dev/docs
- **NightLife Spec:** `docs/superpowers/specs/PROMO-VIDEO-SPEC.md`
- **Music Sources:** Pixabay, YouTube Audio Library, Epidemic Sound
- **Tailwind Classes:** Inline in component (or reference `src/` for exact tokens)

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-24
