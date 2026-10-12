// Week windows.
// A "week" is the 7 days ending at the run time. It is identified by the calendar date
// (in Sumit's timezone, IST by default) on which the window starts: `weekStart`.
//
// Two windows whose start dates are within 3 days of each other are treated as the SAME week.
// So a Wednesday manual run followed by the Friday cron run replaces, rather than doubles, that week.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const OVERLAP_DAYS = 3;

export interface WeekWindow {
  start: Date; // exact start (end minus 7 days)
  end: Date; // exact end (the run time)
  weekStart: string; // YYYY-MM-DD in the configured timezone
  weekEnd: string; // YYYY-MM-DD in the configured timezone
}

/** Calendar date of an instant in a timezone, as YYYY-MM-DD. */
export function dateInZone(d: Date, timeZone: string): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** The 7-day window ending at `end`. */
export function windowEndingAt(end: Date, timeZone: string): WeekWindow {
  const start = new Date(end.getTime() - 7 * DAY_MS);
  return { start, end, weekStart: dateInZone(start, timeZone), weekEnd: dateInZone(end, timeZone) };
}

/** Whole days from date a to date b (both YYYY-MM-DD). Positive when b is later. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** True when two week-start dates describe the same week (within 3 days). */
export function weeksOverlap(a: string, b: string): boolean {
  return Math.abs(daysBetween(a, b)) <= OVERLAP_DAYS;
}

/**
 * The backfill plan: the current week plus the previous (weeks - 1) weeks, all ending at
 * multiples of 7 days before `anchorEnd`. Weeks that already exist are skipped.
 * Returned oldest first, because each week's trend is computed against the week before it.
 */
export function backfillPlan(anchorEnd: Date, existingWeekStarts: string[], timeZone: string, weeks = 4): WeekWindow[] {
  const plan: WeekWindow[] = [];
  for (let k = weeks - 1; k >= 0; k--) {
    const window = windowEndingAt(new Date(anchorEnd.getTime() - k * 7 * DAY_MS), timeZone);
    const exists = existingWeekStarts.some((w) => weeksOverlap(w, window.weekStart));
    if (!exists) plan.push(window);
  }
  return plan;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

/** "5 Oct" */
export function shortDate(date: string): string {
  const { m, d } = parts(date);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "5–12 Oct 2026" or "28 Sep – 5 Oct 2026" */
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const a = parts(weekStart);
  const b = parts(weekEnd);
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (a.y === b.y) return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  return `${a.d} ${MONTHS[a.m - 1]} ${a.y} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
}

/** "Fri 10 Oct, 08:00" in the given timezone. */
export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
