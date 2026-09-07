/**
 * One definition of "attended", used everywhere a percentage is shown —
 * the student portal, the teacher roster, division and institute rollups —
 * so the same student never reads as 80% on one screen and 70% on another.
 *
 * Late still counts as attended; excused does not (it's a sanctioned absence,
 * but an absence — the 75% eligibility rule is about time in class).
 */
export const PRESENT_STATUSES = ["PRESENT", "LATE"] as const;

type AttendanceLike = { status: string };

export function attendancePercent(records: AttendanceLike[]): number | null {
  if (records.length === 0) return null;
  const attended = records.filter((r) => (PRESENT_STATUSES as readonly string[]).includes(r.status)).length;
  return Math.round((attended / records.length) * 100);
}

/**
 * The same percentage, counted in the database.
 *
 * The screens that show a whole institute at once — the student list, the
 * division list, a teacher's roster, the attendance report — used to load
 * every attendance row for the tenant and count them in memory. That's one
 * row per student per subject per day: fine against seed data, hundreds of
 * thousands of rows for a real institute a term in, growing every day it
 * operates. A groupBy returns at most four rows per student instead.
 */
export function percentFromCounts(counts: { status: string; count: number }[]): number | null {
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  if (total === 0) return null;
  const attended = counts
    .filter((c) => (PRESENT_STATUSES as readonly string[]).includes(c.status))
    .reduce((sum, c) => sum + c.count, 0);
  return Math.round((attended / total) * 100);
}

type GroupedRow = { status: string; _count: { _all: number } };

/** Folds a Prisma groupBy result into "id -> percent", keyed by `key`. */
export function percentByKey<K extends string>(
  rows: (GroupedRow & Record<K, string | null>)[],
  key: K,
): Map<string, number> {
  const byId = new Map<string, { status: string; count: number }[]>();
  for (const row of rows) {
    const id = row[key];
    if (!id) continue;
    const list = byId.get(id) ?? [];
    list.push({ status: row.status, count: row._count._all });
    byId.set(id, list);
  }

  const result = new Map<string, number>();
  for (const [id, counts] of byId) {
    const percent = percentFromCounts(counts);
    if (percent !== null) result.set(id, percent);
  }
  return result;
}
