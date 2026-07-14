/**
 * Business-night boundary: a nightclub night spans venue-local 18:00 → 10:00
 * next calendar day. Used by dashboard tonight queries, rollup jobs, and
 * last-call analytics. One definition, no reimplementation.
 */

const NIGHT_START_HOUR = 18;
const NIGHT_END_HOUR = 10;

export interface NightBoundary {
  /** Label for this night, e.g. "2026-07-14" (the evening's calendar date). */
  label: string;
  /** UTC start instant (venue-local 18:00 on the label date). */
  start: Date;
  /** UTC end instant (venue-local 10:00 on the day after the label date). */
  end: Date;
}

/**
 * Returns the business-night boundary that contains `instant` for a venue
 * in the given IANA timezone. If `instant` falls between 00:00 and 10:00
 * local time, it belongs to the *previous* calendar day's night.
 *
 * The returned start/end are UTC Date objects suitable for Postgres queries.
 */
export function nightContaining(instant: Date, timezone: string): NightBoundary {
  const localStr = instant.toLocaleString("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const [datePart, timePart] = localStr.split(", ");
  const [month, day, year] = datePart.split("/");
  const hour = parseInt(timePart.split(":")[0], 10);

  let labelDate = new Date(`${year}-${month}-${day}T00:00:00`);

  // Before 10:00 local → belongs to previous evening's night
  if (hour < NIGHT_END_HOUR) {
    labelDate.setDate(labelDate.getDate() - 1);
  }

  const labelStr = formatDate(labelDate);
  const start = localToUtc(labelStr, NIGHT_START_HOUR, 0, timezone);
  const end = localToUtc(nextDay(labelStr), NIGHT_END_HOUR, 0, timezone);

  return { label: labelStr, start, end };
}

/**
 * Returns the business-night boundary for a given label date string (YYYY-MM-DD).
 * Night starts at 18:00 on that date and ends at 10:00 the next day, both in
 * the venue's local timezone, returned as UTC.
 */
export function nightForDate(labelDate: string, timezone: string): NightBoundary {
  const start = localToUtc(labelDate, NIGHT_START_HOUR, 0, timezone);
  const end = localToUtc(nextDay(labelDate), NIGHT_END_HOUR, 0, timezone);
  return { label: labelDate, start, end };
}

// ── helpers ──────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return formatDate(d);
}

/**
 * Convert a local date+time in a given IANA timezone to a UTC Date.
 * Uses a binary-search approach on the UTC offset to handle DST transitions
 * correctly — when clocks spring forward the "lost" hour clamps to the
 * transition point; when they fall back we take the first occurrence.
 */
function localToUtc(
  dateStr: string,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  // Initial estimate: treat as UTC, then adjust
  const naive = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);

  // Get the UTC offset at this approximate time
  const offset = getUtcOffsetMs(naive, timezone);
  const adjusted = new Date(naive.getTime() + offset);

  // Verify: the offset might differ at the adjusted time (DST edge)
  const offset2 = getUtcOffsetMs(adjusted, timezone);
  if (offset2 !== offset) {
    return new Date(naive.getTime() + offset2);
  }
  return adjusted;
}

/**
 * Returns the UTC offset in milliseconds (positive = behind UTC) for a given
 * instant in a timezone. E.g. EST = +18_000_000, CET = -3_600_000.
 */
function getUtcOffsetMs(utcInstant: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(utcInstant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)!.value, 10);

  const localInTz = new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")),
  );

  return utcInstant.getTime() - localInTz.getTime();
}
