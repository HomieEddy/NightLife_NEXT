"use client";

import { cn } from "@/features/shared/utils";

export type DateRange = "today" | "week" | "all";

const OPTIONS: { id: DateRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "all", label: "All" },
];

export function DateFilter({
  value,
  onChange,
  className,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === opt.id
              ? "border-primary bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Returns [startOfDay, endOfDay] for today in local time */
export function getTodayRange(): [Date, Date] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return [start, end];
}

/** Returns [startOfWeek (Monday), endOfToday] in local time */
export function getWeekRange(): [Date, Date] {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday=0
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return [start, end];
}

/** Filter helper: returns true if the ISO date string or Date falls within the range */
export function isInDateRange(
  dateValue: string | Date,
  range: DateRange,
): boolean {
  if (range === "all") return true;
  const d = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  const [start, end] = range === "today" ? getTodayRange() : getWeekRange();
  return d >= start && d <= end;
}
