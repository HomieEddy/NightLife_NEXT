import { cn } from "@/features/shared/utils";
import type {
  EventStatus,
  GuestSessionStatus,
  HelpRequestStatus,
  LeadStatus,
  OrderStatus,
  PromotionStatus,
  ReservationStatus,
  TableStatus,
  TenantStatus,
} from "@/lib/types";

type AnyStatus =
  | OrderStatus
  | TableStatus
  | GuestSessionStatus
  | HelpRequestStatus
  | LeadStatus
  | TenantStatus
  | ReservationStatus
  | EventStatus
  | PromotionStatus;

/**
 * Single source of truth for status colors across all surfaces.
 * amber = needs attention, blue = in motion, violet = in progress,
 * green = good/done, red = bad, gray = inert.
 */
const STATUS_STYLES: Record<AnyStatus, string> = {
  // orders
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  accepted: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  preparing: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  ready: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  delivered: "bg-emerald-500/10 text-emerald-500/80 border-emerald-500/20",
  cancelled: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  // tables
  open: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  occupied: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  reserved: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  closed: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  // guest sessions
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  denied: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  "closure-requested": "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  merged: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  // help requests
  acknowledged: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  resolved: "bg-emerald-500/10 text-emerald-500/80 border-emerald-500/20",
  // leads
  new: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  contacted: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  demo: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  negotiating: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  won: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  lost: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  // tenants
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  trial: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  suspended: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  // reservations
  requested: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  confirmed: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  seated: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  completed: "bg-emerald-500/10 text-emerald-500/80 border-emerald-500/20",
  "no-show": "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  // events
  draft: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  published: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  live: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  ended: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  // promotions
  scheduled: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  expired: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
};

export function StatusBadge({
  status,
  className,
  pulse = false,
}: {
  status: AnyStatus;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] shadow-[inset_0_1px_0_oklch(1_0_0/12%)] backdrop-blur",
        STATUS_STYLES[status],
        className,
      )}
    >
      {pulse && <span className="size-1.5 rounded-full bg-current animate-pulse" />}
      {status.replace(/-/g, " ")}
    </span>
  );
}
