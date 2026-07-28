"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/features/shared/utils";

export interface DateRangeValue {
  from: string; // yyyy-mm-dd or ""
  to: string;   // yyyy-mm-dd or ""
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getDefaultDateRange(): DateRangeValue {
  return { from: todayStr(), to: todayStr() };
}

export function isInCustomDateRange(
  dateValue: string | Date,
  range: DateRangeValue,
): boolean {
  if (!range.from && !range.to) return true;
  const d = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  const dStr = d.toISOString().slice(0, 10);
  if (range.from && dStr < range.from) return false;
  if (range.to && dStr > range.to) return false;
  return true;
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end gap-2", className)}>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">From</Label>
        <Input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="h-8 w-36 text-xs"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="h-8 w-36 text-xs"
        />
      </div>
    </div>
  );
}
