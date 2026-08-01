# PLAN 30 — Foundation Modernization

**Status:** Complete · **Created:** 2026-07-28 · **Closed:** 2026-07-30
**Follow-on:** TanStack Query adoption (PR #90) replaced every hand-rolled fetch
loop with `useQuery`/`useMutation`; key builders live in
`src/features/{domain}/query-keys.ts`.
**Scope:** Architecture refactor + UI polish + UX optimization + animation parity
**Phase:** Cross-cutting modernization (spans Phases 1–4 of the roadmap)

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1 — Foundation Infrastructure](#phase-1--foundation-infrastructure)
3. [Phase 2 — Feature-Folder Reorganization](#phase-2--feature-folder-reorganization)
4. [Phase 3 — BullMQ Queue Infrastructure](#phase-3--bullmq-queue-infrastructure)
5. [Phase 4 — Staff Animation Parity](#phase-4--staff-animation-parity)
6. [Phase 5 — Guest Ordering Flow Animations](#phase-5--guest-ordering-flow-animations)
7. [Phase 6 — Navigation & UX](#phase-6--navigation--ux)
8. [Phase 7 — Cleanup & Optimization](#phase-7--cleanup--optimization)
9. [Master Commit Sequence](#master-commit-sequence)
10. [Risk Matrix](#risk-matrix)
11. [Out of Scope](#out-of-scope)
12. [Verification Ladder](#verification-ladder)

---

## Overview

| Dimension | Current | Target |
|-----------|---------|--------|
| Architecture | Flat `src/lib/` + `src/server/` dirs | 13 domain feature folders under `src/features/` |
| Dates | Raw `Date` manipulation | Standardized via `date-fns` |
| Logging | Ad-hoc `console.*` | Structured `logger.*` wrapper |
| Background jobs | Cron hitting route handlers | BullMQ queue + cron fallback |
| Staff animations | **None** on 13 pages | Fade-in + stagger + count-up + crossfade |
| Guest ordering flow | 7 polished points, 10 gaps | 13 net-new micro-animations |
| Navigation | 25 sidebar items, no breadcrumbs | Breadcrumbs + staff palette + sidebar defaults |
| Empty states | Generic "No items found" | Role-specific contextual guidance |
| Filter state | Inconsistent URL params | URL persistence on 4 remaining pages |

**Packages added:** `date-fns` + `bullmq` (2 total).
**Zero logic changes. Zero API changes.**
**All existing tests must continue to pass.**

---

## Phase 1 — Foundation Infrastructure

### 1.1 Install `date-fns` + create `dates.ts`

New file: `src/features/shared/dates.ts` (co-located after Phase 2; starts in
`src/lib/dates.ts`)

```ts
import {
  format, parse, addHours, addDays, isBefore, isAfter,
  startOfDay, endOfDay, differenceInMinutes, isWithinInterval,
} from "date-fns";

export function formatNightLabel(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseNightLabel(label: string): Date {
  return parse(label, "yyyy-MM-dd", new Date());
}

export function isBetweenDates(instant: Date, start: Date, end: Date): boolean {
  return isWithinInterval(instant, { start, end });
}

export function addHoursTo(date: Date, hours: number): Date {
  return addHours(date, hours);
}

export function addDaysTo(date: Date, days: number): Date {
  return addDays(date, days);
}

export function dateIsBefore(a: Date, b: Date): boolean {
  return isBefore(a, b);
}

export function dateIsAfter(a: Date, b: Date): boolean {
  return isAfter(a, b);
}

export function startOf(date: Date): Date {
  return startOfDay(date);
}

export function endOf(date: Date): Date {
  return endOfDay(date);
}

export function minutesBetween(a: Date, b: Date): number {
  return differenceInMinutes(b, a);
}
```

Replace raw `Date` math in:
| File | Call sites |
|------|-----------|
| `src/server/night.ts` | 5 |
| `src/server/analytics-core.ts` | 8 |
| `src/server/analytics-core-phase4.ts` | 12 |
| `src/lib/happy-hour.ts` | 3 |
| `src/server/reservation-core.ts` | 4 |
| `src/server/promotions-core.ts` | 2 |
| `src/server/report-core.ts` | 2 |

**~15 files, ~40 call sites. No behavior change.**

### 1.2 Create structured logger

New file: `src/features/shared/logger.ts` (co-located after Phase 2; starts in
`src/lib/logger.ts`)

```ts
type LogMeta = Record<string, unknown>;

const logger = {
  info(msg: string, meta?: LogMeta) {
    console.log(JSON.stringify({ level: "info", ts: new Date().toISOString(), msg, ...meta }));
  },
  warn(msg: string, meta?: LogMeta) {
    console.warn(JSON.stringify({ level: "warn", ts: new Date().toISOString(), msg, ...meta }));
  },
  error(msg: string, meta?: LogMeta) {
    console.error(JSON.stringify({ level: "error", ts: new Date().toISOString(), msg, ...meta }));
  },
};

export { logger };
```

Replace `console.log`/`console.error` in:
| File | Call sites |
|------|-----------|
| `src/server/venue-core.ts` | 4 |
| `src/server/order-core.ts` | 8 |
| `src/server/session-core.ts` | 4 |
| `src/server/menu-core.ts` | 6 |
| `src/server/staff-core.ts` | 3 |
| `src/server/floor-core.ts` | 5 |
| `src/server/events.ts` | 3 |
| `src/server/notifications/dispatch.ts` | 6 |
| `src/server/auth-helpers.ts` | 3 |
| `src/server/rate-limit.ts` | 2 |
| Route handlers (various) | ~15 |

**~25 files, ~60 call sites. No behavior change.**

---

## Phase 2 — Feature-Folder Reorganization

### 2.1 Target structure

```
src/features/
├── venue/           services.ts, mock-service.ts, mock-data.ts, live-service.ts,
│                    schemas.ts, core.ts, types.ts
├── menu/            same pattern + menu-core.test.ts
├── ordering/        same pattern + pricing.ts + pricing.test.ts + fees.ts +
│                    order-status.ts
├── sessions/        same pattern (guest sessions + help requests)
├── hospitality/     reservation-service.ts, events-service.ts, promotions-service.ts,
│                    schemas/, reservation-core.ts, events-core.ts, promotions-core.ts + test
├── workforce/       staff-service.ts, time-service.ts, tips-service.ts,
│                    commission-service.ts, certification-service.ts,
│                    schemas/, staff-core.ts + test, shift-core.ts
├── door/            services.ts, waitlist-service.ts, mock-services/, live-services/
├── safety/          services.ts, mock-services/, live-services/
├── guests/          services.ts, mock-services/, live-services/, guest-auth.ts
├── analytics/       analytics-service.ts + test, report-service.ts,
│                    analytics-core.ts + integration test, analytics-phase4.ts + test,
│                    report-core.ts, report-csv.ts + test
├── realtime/        pulse-service.ts, show-queue-service.ts,
│                    floor-core.ts + test, events.ts + test, sse.ts
├── notifications/   schemas.ts, dispatch.ts, email.ts, sms.ts + templates, push.ts,
│                    integration test
├── automation/      services.ts, core.ts, defaults.ts, integration test
├── platform/        admin-service.ts, auth-service.ts, billing-service.ts,
│                    permission-service.ts, audit-service.ts,
│                    admin-core.ts + test, stripe.ts, auth/, rate-limit-platform.ts,
│                    guest-lookup.ts
├── shared/          app-mode.ts + test, app-origins.ts + test, db.ts, env.ts,
│                    money.ts + test, table-token.ts + test, night.ts + test,
│                    rate-limit.ts + test, test-helpers.ts, test-pglite.ts,
│                    logger.ts, dates.ts, format.ts, id.ts, utils.ts,
│                    navigation.ts + test, entity-links.ts, permissions.ts,
│                    role-capabilities.ts, zone-colors.ts, eta.ts,
│                    download-csv.ts, live-mock-stub.ts
└── queue/           connection.ts, worker.ts, types.ts (Phase 3)
```

### 2.2 Import path conventions

```ts
// Before
import { venueService } from "@/lib/services/venue-service";
import { createZone } from "@/server/venue-core";
import { zZoneInput } from "@/server/schemas/venue";

// After
import { venueService } from "@/features/venue/services";
import { createZone } from "@/features/venue/core";
import { zZoneInput } from "@/features/venue/schemas";
```

The `@/` path alias maps to `src/`, so `@/features/*` resolves naturally with no
tsconfig changes needed.

### 2.3 Migration order

| Step | Feature | Files moved | Risk |
|------|---------|-------------|------|
| 1 | Create empty `src/features/` structure | 0 | None |
| 2 | `shared/` (foundation modules) | ~25 | Low — other features import from here |
| 3 | `venue/` | ~6 | Low |
| 4 | `menu/` | ~8 | Low |
| 5 | `ordering/` | ~8 | Medium — pricing + fees depend on types |
| 6 | `sessions/` | ~6 | Low |
| 7 | `hospitality/` | ~10 | Low |
| 8 | `workforce/` | ~12 | Medium — 5 services merged |
| 9 | `door/` + `safety/` | ~8 | Low |
| 10 | `guests/` | ~5 | Low |
| 11 | `analytics/` | ~8 | Medium — integration tests |
| 12 | `realtime/` | ~6 | Medium — SSE + events |
| 13 | `notifications/` | ~6 | Low |
| 14 | `automation/` | ~5 | Low |
| 15 | `platform/` | ~10 | Medium — auth/Stripe |
| 16 | `queue/` | ~3 | Low (Phase 3) |

### 2.4 Config updates

After all feature moves, update `next.config.ts` Turbopack aliases:

```ts
const mockServiceFiles = [
  "venue/services", "menu/services", "ordering/services",
  "sessions/services", "hospitality/reservation-service",
  "hospitality/events-service", "hospitality/promotions-service",
  "workforce/staff-service", "workforce/time-service",
  "workforce/tips-service", "workforce/commission-service",
  "workforce/certification-service", "door/services",
  "safety/services", "guests/services", "analytics/analytics-service",
  "analytics/report-service", "realtime/pulse-service",
  "realtime/show-queue-service", "automation/services",
  "platform/admin-service", "platform/auth-service",
  "platform/billing-service", "platform/permission-service",
  "platform/audit-service",
];

const liveMockAliases = Object.fromEntries(
  mockServiceFiles.map((file) => [
    `@/features/${file}`,
    "./src/lib/live-mock-stub.ts",
  ]),
);
```

Update `eslint.config.mjs` restricted import patterns:

```ts
patterns: [{
  group: ["@/features/*/mock-service*", "@/features/*/mock-data*",
          "@/components/demo/*"],
  message: "Live UI must use feature service selectors, not mock internals.",
}]
```

### 2.5 Empty old directories

After verification:
- Delete `src/lib/services/` (28 selectors — now in feature folders)
- Delete `src/lib/mock-services/` (33 files — now in feature folders)
- Delete `src/lib/mock-data/` (19 files — now in feature folders)
- Delete `src/lib/live-services/` (28 files — now in feature folders)
- Delete `src/server/schemas/` (11 files — now in feature folders)
- Keep `src/lib/` for remaining root-level files until all are migrated

**Total: ~170 files moved, ~300 imports updated. 16 commits.**

---

## Phase 3 — BullMQ Queue Infrastructure

### 3.1 New files

```
src/features/queue/connection.ts   — Redis connection factory
src/features/queue/worker.ts       — JobProcessor type + registerWorker()
src/features/queue/types.ts        — JobType enum, payload interfaces
```

### 3.2 `types.ts`

```ts
export enum JobType {
  NightlyRollup = "nightly-rollup",
  ReservationReminders = "reservation-reminders",
  ReportSchedules = "report-schedules",
}

export type NightlyRollupPayload = { venueId: string; nightLabel: string };
export type ReservationRemindersPayload = { venueId: string };
export type ReportSchedulesPayload = { venueId: string };
export type JobPayload = NightlyRollupPayload | ReservationRemindersPayload | ReportSchedulesPayload;
```

### 3.3 `connection.ts`

```ts
import { Queue, Worker } from "bullmq";
import { getLiveEnv } from "@/features/shared/env";
import { logger } from "@/features/shared/logger";

const env = getLiveEnv();
const connection = env.REDIS_URL
  ? { connection: { url: env.REDIS_URL } }
  : undefined;

export function createQueue(name: string): Queue | null {
  if (!connection) {
    logger.warn(`Queue "${name}" skipped — REDIS_URL not configured`);
    return null;
  }
  return new Queue(name, connection);
}

export function createWorker(
  name: string,
  handler: (job: { data: unknown }) => Promise<void>,
): Worker | null {
  if (!connection) return null;
  const worker = new Worker(name, handler, { ...connection, concurrency: 1 });
  worker.on("failed", (job, err) =>
    logger.error(`Job ${job?.id} failed`, { queue: name, error: String(err) }),
  );
  return worker;
}
```

### 3.4 Queue jobs (replicating existing cron handlers)

| Job | Cron equivalent | Frequency |
|-----|----------------|-----------|
| `nightly-rollup` | `api/jobs/nightly-rollup` | Daily at 05:00 venue time |
| `reservation-reminders` | `api/jobs/reservation-reminders` | Every 30 min during operating hours |
| `report-schedules` | `api/jobs/report-schedules` | Hourly |

### 3.5 Infrastructure

`compose.yaml` — optional Redis service (profile-gated):

```yaml
redis:
  image: redis:7-alpine
  profiles: [queue]
  ports: ["6379:6379"]
```

`.env.example` — add:

```env
REDIS_URL=redis://localhost:6379
```

Cron handlers (`src/app/api/jobs/*`) remain as fallback. Queue is additive, not
replacement.

**~5 new files. Zero existing code modified. ~80 new lines.**

---

## Phase 4 — Staff Animation Parity

### 4.1 One-className-per-page (13 pages)

Every staff page gets `animate-fade-in` on the outer wrapper. List views get
`stagger-children`.

| Page | Changes |
|------|---------|
| `/staff/page.tsx` | `animate-fade-in` + `CountUp` on 4 metric cards |
| `/staff/orders/page.tsx` | `animate-fade-in` + `stagger-children` on order list |
| `/staff/approvals/page.tsx` | `animate-fade-in` + `stagger-children` on approval list |
| `/staff/help/page.tsx` | `animate-fade-in` + `stagger-children` on help list |
| `/staff/chat/page.tsx` | `animate-fade-in` on wrapper |
| `/staff/notifications/page.tsx` | `animate-fade-in` + `stagger-children` |
| `/staff/schedule/page.tsx` | `animate-fade-in` + `stagger-children` |
| `/staff/tips/page.tsx` | `animate-fade-in` + `stagger-children` |
| `/staff/door/page.tsx` | `animate-fade-in` + `stagger-children` |
| `/staff/incidents/page.tsx` | `animate-fade-in` + `stagger-children` |
| `/staff/events/page.tsx` | `animate-fade-in` + `stagger-children` |
| `/staff/reservations/page.tsx` | `animate-fade-in` + `stagger-children` |

### 4.2 Wire dormant FX components

| Component | File | Change |
|-----------|------|--------|
| `CountUp` on dashboard metrics | `staff/page.tsx` | Wrap 4 `<MetricCard>` values in `<CountUp>` |
| Status badge pulse | `shared/status-badge.tsx` | `key={status}` to re-trigger `animate-pop-in` on change |
| Card entrance for live items | `staff/orders/page.tsx`, `staff/help/page.tsx` | `animate-fade-up` on newly-arrived cards (track via `newItemIds` set) |
| `Magnetic` on dashboard cards | `staff/page.tsx` | Wrap metric cards in `<Magnetic>` (no-op on touch) |

### 4.3 Skeleton-to-content crossfade

New component: `src/components/fx/fade-in.tsx`

```tsx
"use client";
import type { ReactNode } from "react";

export function FadeIn({ show, children }: { show: boolean; children: ReactNode }) {
  return <div className={show ? "animate-fade-in" : "opacity-0"}>{children}</div>;
}
```

Replace `loading ? <Skeleton /> : <Content />` with
`<FadeIn show={!loading}><Content /></FadeIn>` on:

- Staff home, orders, approvals, help, door, incidents, reservations, schedule,
  tips, events (10 pages)
- Guest menu, orders, cart, receipt (4 pages)
- Manager pages where applicable (10 pages)

**~3 new lines (component) + ~24 call site changes. Pure CSS, no GSAP.**

---

## Phase 5 — Guest Ordering Flow Animations

### 5.1 Revenue Touchpoints

#### 5.1a — Item fly to cart pill

**Currently:** Toast + CartSheet elastic bounce (disconnected visual).

**Add:** On `addToCart()`, create a temporary absolutely-positioned clone of the
item's price badge, GSAP `to()` it toward the cart pill position over 400ms
(`power2.in`), then fire the existing pill bounce. Clone is removed on complete.

Files: `src/components/guest/item-detail-modal.tsx`,
`src/components/shared/menu-item-card.tsx`
(~15 lines in the Add button handler).

Respects `prefers-reduced-motion` — skip clone, keep toast only.

#### 5.1b — OrderTracker progress bars animated fill

**Currently:** Step connector bars switch `bg-border` → `bg-primary` instantly.

**Add:** Connector `<div>` between steps gets CSS width transition:

```css
.order-connector {
  width: 0;
  transition: width 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}
.order-connector[data-done="true"] {
  width: 100%;
}
```

Step circle gets `animate-pop-in` re-triggered via `key` prop on status change.

File: `src/app/(guest)/guest/(tabs)/orders/page.tsx`

#### 5.1c — Receipt staged reveal

**Currently:** `animate-pop-in` on hero + `animate-fade-up` on cards fire
simultaneously. `CountUp` scroll-triggered only (shows 0 if already in view).

**Fix + enhance:**
1. Add `startOnMount` prop to `CountUp` — fire immediately, scroll trigger as
   fallback.
2. Stage: hero `animate-pop-in` → receipt body `animate-fade-up` (450ms delay) →
   split bill `animate-fade-up` (200ms delay) → action buttons `animate-fade-up`
   (400ms delay).

Files: `src/app/(guest)/guest/(tabs)/receipt/page.tsx`,
`src/components/fx/count-up.tsx`

### 5.2 Flow Transitions

#### 5.2a — Category filter crossfade

**Currently:** Switching categories changes the `key` prop, triggering remount
with `stagger-children` but the old list vanishes instantly.

**Add:** Wrap list in container with CSS opacity flip. Local `transitioning`
state — on category change, add `opacity-0`, then `opacity-100` after next frame
via `requestAnimationFrame`.

File: `src/app/(guest)/guest/(tabs)/menu/page.tsx`
(~10 lines, pure CSS, no GSAP)

#### 5.2b — "Order placed" overlay

**Currently:** After confirm + submit, `clearCart()` → `router.push("/guest/orders")`.
Cart flashes empty then navigates.

**Add:** On submit success, show full-screen overlay with `animate-pop-in` +
`CheckCircle2` icon + "Order sent" → hold 600ms → navigate.

File: `src/components/guest/cart-contents.tsx`

```tsx
const [placing, setPlacing] = useState(false);
// on success:
setPlacing(true);
setTimeout(() => router.push("/guest/orders"), 900);

// render:
if (placing) return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
    <div className="flex flex-col items-center gap-4 animate-pop-in">
      <CheckCircle2 className="h-16 w-16 text-primary" />
      <p className="text-xl font-semibold">Order sent!</p>
      <p className="text-muted-foreground">Taking you to your orders...</p>
    </div>
  </div>
);
```

#### 5.2c — Closure gate crossfade

**Currently:** `ClosureGate` is an if/else render — menu disappears instantly
when `closureStatus` changes to `"requested"`.

**Add:** Three-state local `phase`: `"active" | "fading" | "blocked"`. On status
change: set `"fading"` (children get `opacity-0 transition-opacity duration-300`),
wait 300ms, set `"blocked"` (children unmount, gate renders with `animate-fade-up`).

File: `src/components/guest/closure-gate.tsx`

### 5.3 Micro-Interactions

#### 5.3a — Modifier selection ripple + scale pop

`key={`${option.id}-${selected}`}` on modifier row → remount triggers
`animate-pop-in` on selection toggle.

File: `src/components/guest/item-detail-modal.tsx`

#### 5.3b — Quantity digit pulse

`<span key={quantity} className="animate-pop-in tabular-nums">{quantity}</span>`

Files: `src/components/guest/item-detail-modal.tsx`,
`src/components/guest/cart-contents.tsx`

#### 5.3c — Cart line item slide-out removal

`removingLineIds: Set<string>` local state. On confirm: add to set, apply
`opacity-0 translate-x-4 transition-all duration-300`, call `removeLine()` after
300ms.

File: `src/components/guest/cart-contents.tsx`

#### 5.3d — Promo code badge entrance

`key={appliedPromoCode}` on badge wrapper → `animate-pop-in` on validate.

File: `src/components/guest/cart-contents.tsx`

#### 5.3e — Last-call banner slide-down

CSS `animate-fade-up` on the banner element (covers fade + slide from above with
`nln-fade-up` keyframe's `translateY(12px→0)`).

File: `src/components/guest/closure-gate.tsx` (or guest layout header)

#### 5.3f — Package card ambient glow pulse

Add `animate-glow-pulse` alongside `focal-halo` on featured packages for a subtle
living glow.

File: `src/components/guest/package-card.tsx`

#### 5.3g — Order status badge pop on SSE updates

`key={`${order.id}-${order.status}`}` on the `StatusBadge` wrapper — remounts
and plays `animate-pop-in` each time the bartender advances the order.

File: `src/app/(guest)/guest/(tabs)/orders/page.tsx`

**Guest flow total: 10 files, ~130 new lines, 6 GSAP tweens, 7 CSS-only, 0 packages.**

---

## Phase 6 — Navigation & UX

### 6.1 Breadcrumbs on deep manager pages (16 pages)

`PageHeader` already supports a `breadcrumbs` prop. Add breadcrumbs to all
manager pages nested 2+ levels deep:

| Page | Breadcrumb |
|------|-----------|
| `/manager/inventory` | Catalogue → Inventory |
| `/manager/purchasing` | Catalogue → Purchasing |
| `/manager/promotions` | Catalogue → Promotions |
| `/manager/happy-hour` | Catalogue → Happy Hour |
| `/manager/reservations` | Bookings → Reservations |
| `/manager/events` | Bookings → Events |
| `/manager/guests` | Bookings → Guests |
| `/manager/staff` | Team → Staff |
| `/manager/tips` | Team → Tips |
| `/manager/commission` | Team → Commission |
| `/manager/analytics` | Insights → Analytics |
| `/manager/reports` | Insights → Reports |
| `/manager/incidents` | Insights → Incidents |
| `/manager/automations` | Insights → Automations |
| `/manager/cashout` | Insights → Cash Out |
| `/manager/audit` | Insights → Audit Trail |

**One `breadcrumbs={[{ label, href }]}` prop per page. 16 lines total.**

### 6.2 Manager sidebar — collapse Insights by default

`src/lib/navigation.ts`: set `MANAGER_NAV_GROUPS[5]` (Insights: Analytics,
Reports, Automations, Incidents, Cash-out, Audit) default to collapsed.
User expands when needed. Saves 6 visible items.

### 6.3 Staff command palette

Add keyboard shortcut `Ctrl+K` / `Cmd+K` to `StaffShell`. Opens a simplified
`CommandPalette` in `mode="staff"` — searches nav items only (7-9 per role).

Files:
- `src/components/staff/staff-shell.tsx` — add `useEffect` keydown listener +
  render palette
- `src/components/shared/command-palette.tsx` — add `mode="staff"` filtering

### 6.4 Contextual empty states (5 pages)

Replace generic "No items" with role-specific guidance:

| Page | Empty state text |
|------|-----------------|
| `/staff/orders` | Orders placed by guests will appear here. Claim one to start delivering. |
| `/staff/approvals` | When guests scan their table QR code, they'll appear here for approval. |
| `/staff/help` | Guest help requests appear here. Respond to claim and assist. |
| `/staff/door` | Admissions and occupancy tracking will appear here when the venue opens. |
| `/staff/incidents` | Incidents filed by your team appear here for review. |

### 6.5 Filter state in URL (4 pages)

Pages not yet using `useSearchParams` for filter state:

| Page | Filter | URL param |
|------|--------|-----------|
| `/staff/orders` | Active/New/Done pill | `?status=` |
| `/manager/orders` | Same | `?status=` |
| `/manager/guests` | Search query | `?q=` |
| `/manager/staff` | Role filter | `?role=` |

Add `useSearchParams` (under existing `<Suspense>` boundaries) to read/write
filter state.

---

## Phase 7 — Cleanup & Optimization

### 7.1 Remove dead directories

After Phase 2 verification, delete:
- `src/lib/services/`
- `src/lib/mock-services/`
- `src/lib/mock-data/`
- `src/lib/live-services/`
- `src/server/schemas/`

### 7.2 Split `types.ts`

The central `src/lib/types.ts` (2141 lines) contains all domain types. Split
into feature type files (`src/features/*/types.ts`) and keep the central file
as a re-export barrel for backward compatibility:

```ts
export type * from "@/features/venue/types";
export type * from "@/features/menu/types";
export type * from "@/features/ordering/types";
// ...
```

### 7.3 Update docs

- `docs/DDD.md` — add section mapping bounded contexts to `src/features/` directories
- `AGENTS.md` — update architecture diagram to show `src/features/` structure

---

## Master Commit Sequence

| # | Commit | Files | Verifies |
|---|--------|-------|----------|
| 1 | `Add date-fns, create dates.ts and logger.ts` | ~4 | tsc |
| 2 | `Replace raw Date math with date-fns wrappers in server core` | ~15 | tsc, unit tests |
| 3 | `Replace ad-hoc console.* with structured logger in server/` | ~25 | tsc |
| 4 | `Create src/features/ directory structure` | ~15 dirs | — |
| 5 | `Move shared foundation modules to features/shared/` | ~25 | tsc |
| 6 | `Move venue feature to features/venue/` | ~6 | tsc |
| 7 | `Move menu feature to features/menu/` | ~8 | tsc |
| 8 | `Move ordering feature to features/ordering/` | ~8 | tsc |
| 9 | `Move sessions feature to features/sessions/` | ~6 | tsc |
| 10 | `Move hospitality feature to features/hospitality/` | ~10 | tsc |
| 11 | `Move workforce feature to features/workforce/` | ~12 | tsc |
| 12 | `Move door + safety features` | ~8 | tsc |
| 13 | `Move guests feature to features/guests/` | ~5 | tsc |
| 14 | `Move analytics feature to features/analytics/` | ~8 | tsc |
| 15 | `Move realtime feature to features/realtime/` | ~6 | tsc |
| 16 | `Move notifications + automation features` | ~11 | tsc |
| 17 | `Move platform feature to features/platform/` | ~10 | tsc |
| 18 | `Update next.config.ts + eslint config for feature paths` | ~3 | tsc, build |
| 19 | `Remove empty legacy directories` | ~5 dirs | tsc |
| 20 | `Split types.ts into feature types + re-export barrel` | ~14 | tsc |
| 21 | `Add BullMQ queue infrastructure` | ~5 | tsc |
| 22 | `Add staff page entrance animations + stagger + count-up` | ~13 | preview |
| 23 | `Add FadeIn skeleton crossfade across all surfaces` | ~25 | preview |
| 24 | `Wire dormant FX components + status badge pulse` | ~5 | preview |
| 25 | `Add guest fly-to-cart animation` | ~2 | preview |
| 26 | `Add guest order tracker progress bar fill` | ~1 | preview |
| 27 | `Add guest receipt staged reveal` | ~2 | preview |
| 28 | `Add guest flow transitions (category, order overlay, closure gate)` | ~4 | preview |
| 29 | `Add guest micro-interactions (modifier, quantity, slide-out, promo, etc.)` | ~7 | preview |
| 30 | `Add breadcrumbs to 16 deep manager pages` | ~16 | preview |
| 31 | `Collapse Insights sidebar group by default` | ~1 | preview |
| 32 | `Add staff command palette` | ~2 | preview |
| 33 | `Add contextual empty states + filter URL state` | ~9 | preview |
| 34 | `Update docs for new architecture` | ~3 | — |

---

## Risk Matrix

| Phase | Risk | Mitigation |
|-------|------|-----------|
| 1 (date-fns + logger) | **Low** | New files only, no behavior change, tests validate outcomes |
| 2 (feature reorg) | **High** | `git mv` per file, `tsc --noEmit` after each feature, 16 commits, no logic changes |
| 3 (BullMQ) | **Low** | New files only, additive, cron handlers remain as fallback |
| 4 (staff animations) | **Low** | className additions only, preview drive verification |
| 5 (guest flow) | **Medium** | 6 GSAP tweens are self-contained, CSS changes additive, full journey in preview |
| 6 (nav + UX) | **Low** | One prop per page, one string per empty state, no structural changes |
| 7 (cleanup) | **Low** | Remove only what's verified empty, update docs last |

---

## Out of Scope

| Skipped | Reason |
|---------|--------|
| CASL | Custom `DEFAULT_ROLE_PERMISSIONS` + 60+ `StaffAction` types cover all auth |
| next-safe-action | 90+ route handlers with existing Zod+gating pattern work |
| React Hook Form | **Done** — 25 forms converted 2026-07-28; controlled inputs didn't scale |
| Framer Motion | GSAP installed/configured, 5 FX components ready, zero benefit from second lib |
| TanStack Table/Virtual | **Done** (Virtual only) — 15 pages + ChatPanel virtualization 2026-07-28 |
| dnd-kit | **Done** — replaces raw pointer events on floor map 2026-07-28 |
| Recharts | **Done** — `RevenueChart` replaced `MockChart` 2026-07-28 |
| cmdk | Command palette already built; action commands added 2026-07-28 with zero deps |
| React Day Picker | **Done** — `CalendarDatePicker` + `CalendarDateRangePicker` shipped 2026-07-28 |
| ts-pattern | Codebase uses simple if/switch; no pattern-matching cases to improve |
| Pino | Structured logger (Phase 1.2) covers needs without dependency |
| Component file moves | Components stay role-organized in `src/components/` |

---

## Verification Ladder

Executed after every commit:

1. `npx tsc --noEmit` — type safety (non-negotiable)
2. `npx eslint src` — lint (fix only introduced issues)
3. `npm run test` — unit tests
4. `npm run test:integration` — integration tests against PGlite
5. `npm run build` — demo + live build (Phase 2 onwards)
6. Preview drive — exercise flows (Phases 4-7):
   - Join a table as guest → browse menu → add to cart → place order
   - Track order status transitions → request closure → view receipt
   - Staff dashboard → orders → approvals → help → door → incidents
   - Manager breadcrumbs render on deep pages
   - Staff command palette opens, searches, navigates

---
