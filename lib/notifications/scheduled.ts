import "server-only";
import { prisma } from "@/lib/prisma";
import { notifier } from "@/lib/notifications";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";
import { Role, type NotificationType } from "@/generated/prisma/client";

const DAY_MS = 86_400_000;
const FEE_DUE_WINDOW_DAYS = 3;
const ASSIGNMENT_DUE_WINDOW_HOURS = 48;
const OVERDUE_REMINDER_EVERY_DAYS = 7;
const KYC_NUDGE_AFTER_DAYS = 7;
const KYC_NUDGE_EVERY_DAYS = 7;

export type ScheduledRunResult = Record<"FEE_DUE" | "FEE_OVERDUE" | "FOLLOW_UP_DUE" | "KYC_PENDING" | "ASSIGNMENT_DUE_SOON", number>;

/**
 * The key that makes a reminder go out once — or once per period, when
 * `everyMs` is given (the period is a fixed bucket of time, so "weekly" means
 * at most one per calendar-aligned 7-day window). Enforced by a unique index,
 * so overlapping runs can't double-send.
 */
function reminderKey(type: NotificationType, entityType: string, entityId: string, now: Date, everyMs?: number): string {
  const period = everyMs ? `:${Math.floor(now.getTime() / everyMs)}` : "";
  return `${type}:${entityType}:${entityId}${period}`;
}

async function sendOnce(
  tenantId: string,
  recipientId: string,
  type: NotificationType,
  related: { entityType: string; entityId: string },
  payload: { title: string; body: string },
  now: Date,
  everyMs?: number,
): Promise<boolean> {
  return notifier.send(tenantId, recipientId, type, {
    ...payload,
    relatedEntityType: related.entityType,
    relatedEntityId: related.entityId,
    dedupeKey: reminderKey(type, related.entityType, related.entityId, now, everyMs),
  });
}

async function familyRecipients(tenantId: string, studentIds: string[]) {
  const students = await prisma.student.findMany({
    where: { tenantId, id: { in: studentIds } },
    select: { id: true, name: true, userId: true, guardians: { select: { guardian: { select: { userId: true } } } } },
  });
  return new Map(
    students.map((s) => [
      s.id,
      {
        name: s.name,
        recipients: [s.userId, ...s.guardians.map((g) => g.guardian.userId)].filter((id): id is string => !!id),
      },
    ]),
  );
}

/**
 * The time-based reminders PRD §7 lists, which used to exist only as enum
 * values: fees falling due, fees overdue, follow-ups due, KYC left pending,
 * assignments due soon. Idempotent — run it as often as you like.
 */
export async function runScheduledNotifications(tenantId: string, now: Date = new Date()): Promise<ScheduledRunResult> {
  const sent: ScheduledRunResult = { FEE_DUE: 0, FEE_OVERDUE: 0, FOLLOW_UP_DUE: 0, KYC_PENDING: 0, ASSIGNMENT_DUE_SOON: 0 };

  // ── Fees: due within the window, and overdue ────────────────────────────
  const summaries = await getFeeSummaryForTenant(tenantId);
  const owing = summaries.filter((s) => s.balance > 0);
  const families = await familyRecipients(tenantId, owing.map((s) => s.studentId));
  const dueSoonPlans = owing.filter(
    (s) => s.nextDueDate && s.nextDueDate.getTime() - now.getTime() <= FEE_DUE_WINDOW_DAYS * DAY_MS,
  );
  if (dueSoonPlans.length > 0) {
    const installments = await prisma.feePlanInstallment.findMany({
      where: { feePlanId: { in: dueSoonPlans.map((p) => p.feePlanId) }, dueDate: { gte: now, lte: new Date(now.getTime() + FEE_DUE_WINDOW_DAYS * DAY_MS) } },
      select: { id: true, feePlanId: true, label: true, amount: true, dueDate: true },
    });
    for (const inst of installments) {
      const plan = dueSoonPlans.find((p) => p.feePlanId === inst.feePlanId);
      const family = plan && families.get(plan.studentId);
      if (!family) continue;
      for (const recipientId of family.recipients) {
        const ok = await sendOnce(tenantId, recipientId, "FEE_DUE", { entityType: "FeePlanInstallment", entityId: inst.id }, {
          title: "Fee installment due soon",
          body: `${inst.label} of ₹${Number(inst.amount).toLocaleString("en-IN")} for ${family.name} is due on ${inst.dueDate.toLocaleDateString("en-IN")}.`,
        }, now);
        if (ok) sent.FEE_DUE += 1;
      }
    }
  }
  for (const plan of owing.filter((s) => s.isOverdue)) {
    const family = families.get(plan.studentId);
    if (!family) continue;
    for (const recipientId of family.recipients) {
      const ok = await sendOnce(
        tenantId,
        recipientId,
        "FEE_OVERDUE",
        { entityType: "Student", entityId: plan.studentId },
        {
          title: "Fee payment overdue",
          body: `₹${plan.totalDue.toLocaleString("en-IN")} is outstanding for ${family.name}${plan.lateFee > 0 ? `, including a ₹${plan.lateFee.toLocaleString("en-IN")} late fee` : ""}.`,
        },
        now,
        OVERDUE_REMINDER_EVERY_DAYS * DAY_MS,
      );
      if (ok) sent.FEE_OVERDUE += 1;
    }
  }

  // ── Follow-ups due today or overdue, to the counselor who owns the lead ──
  const followUps = await prisma.followUp.findMany({
    where: { tenantId, completedAt: null, scheduledAt: { lte: new Date(now.getTime() + DAY_MS) }, lead: { status: { notIn: ["CONVERTED", "LOST"] } } },
    select: { id: true, scheduledAt: true, lead: { select: { id: true, name: true, assignedCounselorId: true } } },
  });
  for (const f of followUps) {
    if (!f.lead.assignedCounselorId) continue;
    const overdue = f.scheduledAt! < now;
    const ok = await sendOnce(tenantId, f.lead.assignedCounselorId, "FOLLOW_UP_DUE", { entityType: "FollowUp", entityId: f.id }, {
      title: overdue ? "Follow-up overdue" : "Follow-up due",
      body: `${f.lead.name} was due a follow-up on ${f.scheduledAt!.toLocaleDateString("en-IN")}.`,
    }, now);
    if (ok) sent.FOLLOW_UP_DUE += 1;
  }

  // ── KYC still pending a week after admission, to the admissions desk ────
  const stale = await prisma.student.findMany({
    where: { tenantId, status: "KYC_PENDING", createdAt: { lte: new Date(now.getTime() - KYC_NUDGE_AFTER_DAYS * DAY_MS) } },
    select: { id: true, name: true, enrollmentNumber: true, kycDocuments: { where: { required: true, status: { not: "VERIFIED" } }, select: { docType: true } } },
  });
  if (stale.length > 0) {
    const officers = await prisma.user.findMany({
      where: { tenantId, isActive: true, role: { in: [Role.ADMISSION_OFFICER, Role.SUPER_ADMIN] } },
      select: { id: true },
    });
    for (const s of stale) {
      for (const officer of officers) {
        const ok = await sendOnce(
          tenantId,
          officer.id,
          "KYC_PENDING",
          { entityType: "Student", entityId: s.id },
          {
            title: "KYC still incomplete",
            body: `${s.name} (${s.enrollmentNumber}) has ${s.kycDocuments.length} required document${s.kycDocuments.length === 1 ? "" : "s"} outstanding.`,
          },
          now,
          KYC_NUDGE_EVERY_DAYS * DAY_MS,
        );
        if (ok) sent.KYC_PENDING += 1;
      }
    }
  }

  // ── Assignments due within 48h and not yet handed in ────────────────────
  const dueSoon = await prisma.submission.findMany({
    where: {
      tenantId,
      status: "MISSING",
      assignment: { dueDate: { gte: now, lte: new Date(now.getTime() + ASSIGNMENT_DUE_WINDOW_HOURS * 3_600_000) } },
    },
    select: { id: true, studentId: true, assignment: { select: { title: true, dueDate: true } } },
  });
  if (dueSoon.length > 0) {
    const fams = await familyRecipients(tenantId, [...new Set(dueSoon.map((d) => d.studentId))]);
    for (const d of dueSoon) {
      const family = fams.get(d.studentId);
      if (!family) continue;
      for (const recipientId of family.recipients) {
        const ok = await sendOnce(tenantId, recipientId, "ASSIGNMENT_DUE_SOON", { entityType: "Submission", entityId: d.id }, {
          title: "Assignment due soon",
          body: `${d.assignment.title} is due ${d.assignment.dueDate.toLocaleDateString("en-IN")} and hasn't been submitted.`,
        }, now);
        if (ok) sent.ASSIGNMENT_DUE_SOON += 1;
      }
    }
  }

  return sent;
}

const lastRunByTenant = new Map<string, number>();
const OPPORTUNISTIC_EVERY_MS = 60 * 60_000;

/**
 * Runs the reminders for a tenant at most about once an hour, so an institute
 * that never sets up the cron route still gets them whenever someone is using
 * the app. The throttle only saves work — it isn't shared across Next's
 * per-route server bundles, so correctness rests on the dedupe keys, not on
 * this. Errors are logged, never surfaced to the page.
 */
export async function maybeRunScheduledNotifications(tenantId: string): Promise<void> {
  const last = lastRunByTenant.get(tenantId) ?? 0;
  if (Date.now() - last < OPPORTUNISTIC_EVERY_MS) return;
  lastRunByTenant.set(tenantId, Date.now());
  try {
    await runScheduledNotifications(tenantId);
  } catch (error) {
    console.error("[notifications] scheduled run failed", error);
  }
}
