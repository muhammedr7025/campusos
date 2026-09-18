import "server-only";
import { prisma } from "@/lib/prisma";
import type { FeePlan, FeePlanInstallment, Payment, Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Fee balance is always derived — structure/plan total minus the sum of all
 * logged payment rows (corrections included, since they're just additional
 * append-only rows referencing the original, never an UPDATE of `amount`).
 * Never store this as an editable column. See PRD §6.2 / dev prompt §5.
 */
export function computeBalance(
  feePlan: Pick<FeePlan, "totalAmount">,
  payments: Pick<Payment, "amount">[],
) {
  const total = Number(feePlan.totalAmount);
  const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  return { total, paid, balance: Math.max(total - paid, 0) };
}

export function amountDueByDate(installments: Pick<FeePlanInstallment, "amount" | "dueDate">[], asOf: Date) {
  return installments
    .filter((i) => i.dueDate <= asOf)
    .reduce((sum, i) => sum + Number(i.amount), 0);
}

export type LateFeeRule = {
  lateFeeType: string | null;
  lateFeeValue: number | Prisma.Decimal | null;
  gracePeriodDays: number;
};

const DAY_MS = 86_400_000;

/**
 * The late fee a plan has accrued, from the structure's rule (PRD §6.2: "late
 * fee rules" are part of a fee structure). Payments are allocated to
 * installments in sequence, so an installment counts as overdue only for the
 * part of it the money paid so far doesn't reach, and only once its due date
 * plus the grace period has passed.
 *
 *   FLAT    — the rule's value once per overdue installment
 *   PERCENT — the rule's value as a percentage of each overdue installment's
 *             unpaid part
 *
 * Derived every time it's shown, like the balance — never stored.
 */
export function computeLateFee(
  installments: { amount: number | Prisma.Decimal; dueDate: Date; sequence: number }[],
  paid: number,
  rule: LateFeeRule | null | undefined,
  asOf: Date = new Date(),
): number {
  if (!rule || !rule.lateFeeType || rule.lateFeeValue == null) return 0;
  const value = Number(rule.lateFeeValue);
  if (!(value > 0)) return 0;
  const graceMs = Math.max(0, rule.gracePeriodDays) * DAY_MS;

  let remaining = paid;
  let fee = 0;
  for (const i of [...installments].sort((a, b) => a.sequence - b.sequence)) {
    const amount = Number(i.amount);
    const covered = Math.min(remaining, amount);
    remaining -= covered;
    const unpaid = amount - covered;
    if (unpaid <= 0) continue;
    if (i.dueDate.getTime() + graceMs >= asOf.getTime()) continue;
    fee += rule.lateFeeType === "PERCENT" ? (unpaid * value) / 100 : value;
  }
  return Math.round(fee * 100) / 100;
}

export type FeePlanSummary = {
  feePlanId: string;
  studentId: string;
  studentName: string;
  enrollmentNumber: string;
  total: number;
  paid: number;
  balance: number;
  /** Accrued under the structure's late-fee rule; owed on top of `balance`. */
  lateFee: number;
  /** balance + lateFee — what the student would settle today. */
  totalDue: number;
  isOverdue: boolean;
  nextDueDate: Date | null;
};

const LATE_FEE_SELECT = { select: { lateFeeType: true, lateFeeValue: true, gracePeriodDays: true } } as const;

/**
 * One row per student, never per fee plan.
 *
 * An approved discount (and any manual override) supersedes a student's plan
 * by writing a *new* one rather than editing the old — so a student can hold
 * several. Only the newest is what they owe; billing every plan they've ever
 * had would double-count them in every institute-wide total.
 *
 * Payments belong to the student, not to the plan that happened to be current
 * when they paid, so `paid` sums all of them. Otherwise approving a discount
 * would silently zero out money already collected.
 */
export async function getFeeSummaryForTenant(
  tenantId: string,
  filters?: { courseId?: string; divisionId?: string },
  db: Db = prisma,
): Promise<FeePlanSummary[]> {
  const studentWhere = {
    ...(filters?.courseId ? { courseId: filters.courseId } : {}),
    ...(filters?.divisionId ? { divisionId: filters.divisionId } : {}),
  };

  const [plans, payments] = await Promise.all([
    db.feePlan.findMany({
      where: { tenantId, student: studentWhere },
      include: {
        installments: true,
        feeStructure: LATE_FEE_SELECT,
        student: { select: { id: true, name: true, enrollmentNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.payment.findMany({
      where: { tenantId, student: studentWhere },
      select: { studentId: true, amount: true },
    }),
  ]);

  const paidByStudent = new Map<string, number>();
  for (const p of payments) {
    paidByStudent.set(p.studentId, (paidByStudent.get(p.studentId) ?? 0) + Number(p.amount));
  }

  // Plans come back newest-first, so the first one seen per student is current.
  const currentPlans = new Map<string, (typeof plans)[number]>();
  for (const plan of plans) {
    if (!currentPlans.has(plan.studentId)) currentPlans.set(plan.studentId, plan);
  }

  const today = new Date();

  return [...currentPlans.values()].map((plan) => {
    const total = Number(plan.totalAmount);
    const paid = paidByStudent.get(plan.studentId) ?? 0;
    const balance = Math.max(total - paid, 0);
    const due = amountDueByDate(plan.installments, today);
    const isOverdue = balance > 0 && paid < due;
    const lateFee = balance > 0 ? computeLateFee(plan.installments, paid, plan.feeStructure, today) : 0;
    const nextDue = plan.installments
      .filter((i) => i.dueDate >= today)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

    return {
      feePlanId: plan.id,
      studentId: plan.student.id,
      studentName: plan.student.name,
      enrollmentNumber: plan.student.enrollmentNumber,
      total,
      paid,
      balance,
      lateFee,
      totalDue: balance + lateFee,
      isOverdue,
      nextDueDate: nextDue?.dueDate ?? null,
    };
  });
}

/**
 * The student's current plan with every payment they've made, the derived
 * balance, and whether any of it is overdue. `db` lets a transaction read
 * through its own client instead of the global one.
 */
export async function getCurrentFeePlanForStudent(tenantId: string, studentId: string, db: Db = prisma) {
  const plan = await db.feePlan.findFirst({
    where: { tenantId, studentId },
    orderBy: { createdAt: "desc" },
    include: {
      installments: { orderBy: { sequence: "asc" } },
      feeStructure: LATE_FEE_SELECT,
      student: true,
      approvedBy: { select: { name: true } },
    },
  });
  if (!plan) return null;

  // Every payment the student has made, including any logged against a plan
  // this one superseded — see getFeeSummaryForTenant.
  const payments = await db.payment.findMany({
    where: { tenantId, studentId },
    orderBy: { paidAt: "desc" },
    include: { collectedBy: { select: { name: true } }, corrections: { select: { id: true } } },
  });

  const { total, paid, balance } = computeBalance(plan, payments);
  const today = new Date();
  const isOverdue = balance > 0 && paid < amountDueByDate(plan.installments, today);
  const lateFee = balance > 0 ? computeLateFee(plan.installments, paid, plan.feeStructure, today) : 0;
  return { plan: { ...plan, payments }, total, paid, balance, isOverdue, lateFee, totalDue: balance + lateFee };
}
