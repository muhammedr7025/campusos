/**
 * Calendar dates, as opposed to instants. Attendance is "Monday the 18th",
 * not a moment; mixing local-time parsing with UTC serialisation shifted a
 * sheet a day back on any server that isn't on UTC, and picked the wrong
 * "today" around midnight.
 */

/** "2026-09-18" for the given instant, in the server's local calendar. */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The Date to store in a `@db.Date` column for a "YYYY-MM-DD" string. Prisma
 * serialises it in UTC, so UTC midnight is the only value Postgres reads back
 * as the same calendar day.
 */
export function dateOnlyToDb(value: string): Date {
  if (!DATE_ONLY_RE.test(value)) throw new RangeError(`Not a calendar date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

/** The reverse: what a `@db.Date` column holds, as "YYYY-MM-DD". */
export function dbToDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Renders a `@db.Date` value without the viewer's time zone shifting it. */
export function formatDateOnly(value: Date, locale = "en-IN"): string {
  return value.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
