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
