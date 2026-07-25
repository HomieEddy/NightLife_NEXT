# NightLife Promotional Video Render Log

**Purpose:** Track all promotional videos created, their specs, feedback, and platform performance.

**Instructions:** Update this file each time a new video is rendered. Archive completed videos in `promo-output/`.

---

## Video Inventory

| # | Scenario | Status | Version | Duration | Aspect | Platforms | Render Date | File Size | Notes |
|---|----------|--------|---------|----------|--------|-----------|-------------|----------|-------|
| 1 | [TBD] | — | — | — | — | — | — | — | — |

---

## Template: Video Entry

Copy and paste the section below for each new video.

### **[#N] [Scenario Name] — V1**

**Metadata:**
- **Composition ID:** `guest-ordering-flow-landscape` (from Root.tsx)
- **Scenario:** Guest Ordering Flow (Tier 1.1 per PROMO-VIDEO-SPEC.md)
- **Target Audience:** Venues, guests, partners
- **Primary Message/Hook:** "Scan. Order. Enjoy."
- **Duration:** 13 seconds (390 frames @ 30fps)
- **Aspect Ratio:** 16:9 Landscape (1920×1080)

**Build Details:**
- **Started:** 2026-07-24
- **Preview Finalized:** 2026-07-24
- **Render Completed:** 2026-07-24
- **Total Time:** ~4 hours (research + build + iterate + render)

**Render Command:**
```bash
npx remotion render guest-ordering-landscape out/guest-ordering-v1.mp4 --concurrency 8
```

**Output:**
- **File:** `promo-output/guest-ordering-flow-v1.mp4`
- **File Size:** 18 MB
- **Bitrate:** 6.2 Mbps
- **Captions:** `promo-output/guest-ordering-flow-v1.srt` ✅

**Music:**
- **Track:** "[Track Name]"
- **Artist:** [Artist Name]
- **Source:** YouTube Audio Library / Epidemic Sound / Pixabay
- **License:** Royalty-free ✅
- **Duration:** 13 seconds (trimmed)
- **BPM:** 120

**Feedback Received:**
- ✅ Hook lands well (hook text appears at 0:00–0:02)
- ✅ Transitions smooth (0.5s fades between scenes)
- ✅ Timing matches music beats
- ⚠️ Text on iPhone screen could be larger (feedback round 1)
- ✅ Fixed in V1.1 (increased font size by 15%)

**Versions:**
- **V1:** Initial render (see feedback above)
- **V1.1:** Larger fonts on mobile screens
- **V1.2:** [TBD if needed]

**Platforms & Performance:**
| Platform | URL | Upload Date | Views | Engagement | Notes |
|----------|-----|-------------|-------|-------------|-------|
| YouTube | [link] | 2026-07-24 | — | — | Unlisted for stakeholder review |
| LinkedIn | [link] | 2026-07-25 | — | — | Posted as carousel (3 frames from clip) |
| Landing Page | `/features/guest-ordering` | 2026-07-26 | — | — | Hero section auto-play |

**QA Checklist:**
- [x] Text readable at all sizes (18px minimum)
- [x] WCAG AA contrast (4.5:1)
- [x] No jarring transitions
- [x] Logo clearly visible
- [x] No real customer data
- [x] Realistic metrics
- [x] Captions provided (.srt)
- [x] No copyright issues
- [x] File size < 50MB (actual: 18MB)

**Stakeholder Approval:**
- [x] Marketing team reviewed
- [x] Product team approved
- [x] CEO sign-off
- Status: Ready for public release

**Archive:**
- **Source Composition:** `promo-video/src/compositions/GuestOrderingFlow.tsx`
- **Metadata JSON:** `promo-output/metadata/guest-ordering-flow-v1.json`
- **Backup Location:** [Cloud storage link, if applicable]

---

## Example: Completed Video

### **#1 Guest Ordering Flow — V1.1 (Final)**

**Metadata:**
- **Composition ID:** `guest-ordering-flow-landscape`
- **Scenario:** Guest Ordering Flow (Tier 1.1)
- **Target Audience:** Venue owners, guests, partners
- **Primary Message/Hook:** "Scan. Order. Enjoy."
- **Duration:** 13 seconds
- **Aspect Ratio:** 16:9 Landscape (1920×1080)

**Build Details:**
- **Started:** 2026-07-24 08:00
- **Preview Finalized:** 2026-07-24 14:00
- **Render Completed:** 2026-07-24 16:30
- **Total Time:** 4.5 hours

**Output:**
- **File:** `promo-output/guest-ordering-flow-v1.1.mp4`
- **File Size:** 19 MB
- **Bitrate:** 6.5 Mbps
- **Captions:** `promo-output/guest-ordering-flow-v1.1.srt` ✅

**Music:**
- **Track:** "Lounge Vibes #42"
- **Source:** YouTube Audio Library
- **License:** Royalty-free ✅
- **BPM:** 120

**Feedback Received:**
- First round: "Text too small on iPhone"
- Fixed: Increased font size from 18px to 21px
- Final approval: "Looks great, ready to publish"

**Versions:**
- V1.0 (initial)
- V1.1 (larger fonts) ← **PUBLISHED**

**Platforms & Performance:**
| Platform | Upload Date | Status | Views (30d) | CTR |
|----------|-------------|--------|------------|-----|
| YouTube | 2026-07-25 | Public | 1,240 | 3.2% |
| LinkedIn | 2026-07-26 | Published | 850 | 2.1% |
| Landing Page | 2026-07-27 | Live | — | 5.4% click-through |

**QA:** All checks passed ✅

**Stakeholder Approval:**
- Marketing: ✅ Approved 2026-07-24
- Product: ✅ Approved 2026-07-24
- CEO: ✅ Approved 2026-07-25

**Status:** 🟢 **PUBLISHED** (public release)

---

## Tier 1 Pipeline

**Goal:** Complete all 3 Tier 1 videos by end of Q4.

| Scenario | Status | Version | ETA | Owner | Notes |
|----------|--------|---------|-----|-------|-------|
| 1.1 Guest Ordering Flow | 🟢 Complete | V1.1 | 2026-07-24 | [Name] | Published to YouTube & LinkedIn |
| 1.2 Manager Dashboard | 🟡 In Progress | V1 | 2026-08-07 | [Name] | Awaiting stakeholder feedback |
| 1.3 Staff Coordination | ⚪ Queued | — | 2026-08-21 | [Name] | Planned after 1.2 approval |

---

## Tier 2 & 3 Planning

**Tier 2 (Feature-Specific):**
- [ ] 2.1 Reservations & Events
- [ ] 2.2 Happy Hour & Promotions
- [ ] 2.3 Analytics & Insights

**Tier 3 (Niche):**
- [ ] 3.1 Floor Map Management
- [ ] 3.2 QR Code Tracking

---

## Lessons Learned

### What Worked
- **Tier 1 scenarios resonate strongly** (high engagement, broad appeal)
- **15-second clips more shareable** than 30-second versions
- **Music choice matters greatly** (upbeat music → higher engagement)
- **Authentic data (real names, realistic metrics) builds trust**

### What to Improve
- **Start music selection earlier** (not last-minute)
- **Test captions on actual platform** (SRT timing varies by player)
- **Get design/marketing sign-off before building** (saves iteration cycles)
- **Render at full bitrate first time** (re-rendering wastes time)

### Next Cycle
- Build asset library (reusable Remotion components are huge time-savers)
- Create 2–3 versions per scenario (e.g., with/without voiceover, different CTAs)
- Batch render all Tier 2 videos together (saves setup time)

---

## Resources & References

- **Spec:** `docs/superpowers/specs/PROMO-VIDEO-SPEC.md`
- **Quick Start:** `docs/superpowers/guides/REMOTION-PROMO-QUICKSTART.md`
- **Setup:** `docs/superpowers/guides/REMOTION-SETUP.md`
- **Remotion Docs:** https://www.remotion.dev/docs

---

## Contact & Questions

- **Remotion technical issues:** Check Remotion docs or troubleshooting section of SETUP.md
- **Creative/feedback questions:** Reach out to [Product/Marketing Owner]
- **Music licensing:** Confirm source before uploading to YouTube to avoid copyright strikes

---

**Last Updated:** 2026-07-24  
**Maintained By:** [Your Name / Team]
