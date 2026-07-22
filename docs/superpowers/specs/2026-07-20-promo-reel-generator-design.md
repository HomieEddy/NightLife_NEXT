# Promo Reel Generator — Design Spec

**Date:** 2026-07-20
**Status:** Draft
**Scope:** Automated Instagram Reels generation from scripted app demo flows

---

## Problem

NightLife_NEXT needs a steady stream of Instagram Reels showcasing app features
to drive venue sales and build industry presence. Currently there is no content
workflow — no tools, no templates, no pipeline. Filming and editing manually
doesn't scale.

## Solution

An OpenMontage-powered pipeline that auto-generates Instagram Reels from
scripted app demo flows. Claude Code records the demo via browser automation,
WhisperX transcribes, Claude generates hooks and captions, Remotion composes the
final video with word-by-word captions and royalty-free background music.

Output: 1080×1920 MP4 ready to post to Instagram Reels.

---

## Architecture

```
Flow script (YAML)
  → Claude browser automation records app demo (Screen Demo pipeline)
  → WhisperX transcribes + generates word-level timestamps
  → Claude API generates hooks + captions from flow context
  → Remotion composes (captions, transitions, hook intro, CTA outro)
  → Background music mixed in via FFmpeg
  → Output: 1080×1920 Instagram Reel (MP4, H.264)
  → Human review → approve → post
```

### Layers

**Layer 1 — Flow Scripts:** YAML files describing user journeys through the app.
Each script defines click/type/wait/scroll steps, narration cues (what to
communicate at each step), and highlight markers (hero moments for emphasis).

**Layer 2 — Recording:** Claude Code's browser automation executes the flow
against the running NightLife_NEXT demo app and records the session as video.
Uses OpenMontage's Screen Demo pipeline.

**Layer 3 — Processing:** WhisperX extracts word-level timestamps from any audio.
Claude API analyzes the flow context and generates hook copy + caption text.

**Layer 4 — Composition:** Remotion renders the final Reel — word-by-word caption
animations, intro hook sequence, CTA outro card, scene transitions. FFmpeg mixes
in the background music track and encodes to H.264.

**Layer 5 — Review:** Human checkpoint before posting. Review clips, captions,
hooks. Approve or request edits.

---

## Components

### A. Flow Script Library

Location: `scripts/flows/` (or equivalent within OpenMontage project structure)

Each flow is a YAML file describing a user journey:

**Guest flows:**
- Scan QR → join table → browse menu → add items → place order → receive delivery

**Manager flows:**
- View dashboard → check analytics → manage zones → configure tables → adjust fees

**Staff flows:**
- Claim order → prepare items → mark delivered → handle help request

Each script includes:
- **Steps:** click, type, wait, scroll actions with selectors and timing
- **Narration cues:** what to communicate at each step (drives caption generation)
- **Highlight markers:** which moments are hero shots (order confirmation, real-time notification, etc.)

### B. Brand Layer

A config file defining visual identity for Remotion composition:

- **Caption style:** font family, size, color, position, animation (word-by-word pop)
- **Intro template:** logo reveal or hook text card
- **Outro template:** CTA card ("Try the free demo", "Link in bio")
- **Color palette:** matching NightLife_NEXT UI tokens
- **Audio:** path to bundled royalty-free background music track

### C. Hook Template Library

Reusable hook patterns that Claude remixes per flow:

| Pattern | Example |
|---|---|
| Curiosity | "Wait till you see what happens when a guest scans this QR code" |
| Problem/solution | "Lost orders? Not anymore" |
| Speed flex | "From scan to order in under 30 seconds" |
| Before/after | "Before NightLife vs. After NightLife" |
| CTA | "Link in bio to try the free demo" |

Claude selects and adapts based on flow content. The hook library grows over time
as new patterns perform well on Instagram.

### D. Orchestrator CLI

A simple command-line interface to run the pipeline:

```
generate-reel --flow guest-ordering --hook curiosity --duration 30s
```

Parameters:
- `--flow`: which flow script to execute (required)
- `--hook`: hook pattern to use (optional, Claude picks if omitted)
- `--duration`: target Reel length — 15s, 30s, or 60s (default: 30s)
- `--music`: background track override (default: from brand config)
- `--review`: open preview before finalizing (default: true)

---

## Tech Stack

### Core (from OpenMontage)

| Tool | Role |
|---|---|
| Python 3.10+ | Orchestration layer |
| FFmpeg | Video encoding, trimming, audio muxing, music mixing |
| Remotion (Node.js 18+) | Composition — captions, transitions, animations |
| WhisperX | Speech-to-text with word-level timestamps |
| Claude API | Hook copy generation, caption text, flow analysis |

### Assets

- **Music:** royalty-free tracks bundled locally (no external API)
- **Fonts:** bundled or Google Fonts via Remotion

### Hosting

- Runs locally on dev machine or self-hosted on OVHcloud VPS
- No external SaaS dependency for core pipeline
- Claude API is the only paid dependency (~$0.02–0.10 per Reel)

---

## Output Specification

| Property | Value |
|---|---|
| Format | MP4 (H.264) |
| Resolution | 1080 × 1920 (9:16) |
| Frame rate | 30 fps |
| Duration | 15–60 seconds |
| Audio | Royalty-free background music, no voiceover |
| Captions | Styled word-by-word text animation |
| Platform | Instagram Reels |

---

## Workflow

1. Write a flow script (once per journey, reusable)
2. Run `generate-reel --flow guest-ordering`
3. Claude opens the NightLife_NEXT demo app, executes the flow, records video
4. WhisperX transcribes any audio
5. Claude generates hook + captions from flow context
6. Remotion composes: hook intro → demo clips → word-by-word captions → CTA outro
7. FFmpeg mixes background music + encodes final MP4
8. Human reviews output → approves → posts to Instagram

New flow script = new Reel. The library of flows grows over time.

---

## Content Strategy (Initial Flows)

Priority order for first batch of Reels:

1. **Guest QR ordering** — the signature feature, most visually compelling
2. **Real-time staff coordination** — orders appearing, claims, deliveries
3. **Manager analytics dashboard** — data visualizations, reports
4. **Table/zone management** — drag-and-drop floor map
5. **Menu management** — adding items, categories, pricing

Each flow produces 2–3 Reel variants (different hooks, durations).

---

## Constraints & Decisions

- **Instagram only** — no multi-platform output for now
- **App demos only** — no real venue footage in initial scope
- **Text captions only** — no AI voiceover narration initially
- **Self-hosted** — no dependency on external video SaaS
- **Human review required** — no auto-posting
- **OpenMontage Screen Demo pipeline** — no custom recording infrastructure

---

## Future Extensions (Out of Scope)

- AI voiceover narration (ElevenLabs or Piper TTS)
- Real venue footage (hybrid pipeline combining app demos + filmed content)
- Multi-platform output (TikTok, YouTube Shorts, LinkedIn)
- Customer-facing content generation (venue managers generate their own promos)
- Auto-scheduling and posting (Instagram API integration)
- A/B testing different hooks for engagement metrics
- Photo generation for Instagram feed posts (static carousel content)

---

## Cost Estimate

| Item | Cost |
|---|---|
| Claude API (hook + caption generation) | ~$0.02–0.10 per Reel |
| OpenMontage | Free (open source) |
| FFmpeg, Remotion, WhisperX | Free (open source) |
| Music | Free (royalty-free, bundled) |
| Hosting | Existing infrastructure (local or OVHcloud) |
| **Total per Reel** | **~$0.02–0.10** |
