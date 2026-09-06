type FollowUpLike = { scheduledAt: Date | null; completedAt: Date | null };

/**
 * A lead is overdue when a follow-up was scheduled, that date has passed, and
 * nobody has logged it as done. Leads with nothing scheduled aren't overdue —
 * they were never promised a call — which is why the pipeline board and the
 * follow-ups queue must use this same rule to agree with each other.
 */
export function isFollowUpOverdue(followUps: FollowUpLike[], asOf: Date = new Date()): boolean {
  return followUps.some((f) => f.scheduledAt != null && f.completedAt == null && f.scheduledAt < asOf);
}

/** The soonest still-outstanding follow-up, overdue ones included. */
export function nextFollowUpDate(followUps: FollowUpLike[], _asOf: Date = new Date()): Date | null {
  const pending = followUps
    .filter((f): f is { scheduledAt: Date; completedAt: null } => f.scheduledAt != null && f.completedAt == null)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  return pending[0]?.scheduledAt ?? null;
}
