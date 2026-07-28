import {
  format,
  addDays,
  startOfDay,
  endOfDay,
  isWithinInterval,
  getDay,
} from "date-fns";

/** Format a Date as yyyy-MM-dd (night labels, date keys). */
export function formatISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Add `n` calendar days to a date. */
export function addDaysTo(d: Date, n: number): Date {
  return addDays(d, n);
}

/** Midnight UTC at the start of `d`'s calendar day. */
export function startOfDate(d: Date): Date {
  return startOfDay(d);
}

/** One millisecond before midnight at the end of `d`'s calendar day. */
export function endOfDate(d: Date): Date {
  return endOfDay(d);
}

/** True when `instant` falls inside [start, end]. */
export function isBetween(instant: Date, start: Date, end: Date): boolean {
  return isWithinInterval(instant, { start, end });
}

/** Day of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday. */
export function dayOfWeek(d: Date): number {
  return getDay(d);
}

/**
 * Parse "YYYY-MM-DD" back to a local-midnight Date.
 * Uses local time (no Z suffix) to match the original behaviour.
 */
export function parseISODate(label: string): Date {
  return new Date(label + "T00:00:00");
}
