import "server-only";
import { prisma } from "@/lib/prisma";
import type { FeePlan, FeePlanInstallment, Payment } from "@/generated/prisma/client";

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

export type FeePlanSummary = {
  feePlanId: string;
  studentId: string;
  studentName: string;
  enrollmentNumber: string;
  total: number;
  paid: number;
  balance: number;
  isOverdue: boolean;
  nextDueDate: Date | null;
};

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
export async function getFeeSummaryForTenant(tenantId: string, filters?: { courseId?: string; divisionId?: string }): Promise<FeePlanSummary[]> {
  const studentWhere = {
    ...(filters?.courseId ? { courseId: filters.courseId } : {}),
    ...(filters?.divisionId ? { divisionId: filters.divisionId } : {}),
  };

  const [plans, payments] = await Promise.all([
    prisma.feePlan.findMany({
      where: { tenantId, student: studentWhere },
      include: {
        installments: true,
        student: { select: { id: true, name: true, enrollmentNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
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
      isOverdue,
      nextDueDate: nextDue?.dueDate ?? null,
    };
  });
}

export async function getCurrentFeePlanForStudent(tenantId: string, studentId: string) {
  const plan = await prisma.feePlan.findFirst({
    where: { tenantId, studentId },
    orderBy: { createdAt: "desc" },
    include: {
      installments: { orderBy: { sequence: "asc" } },
      student: true,
      approvedBy: { select: { name: true } },
    },
  });
  if (!plan) return null;

  // Every payment the student has made, including any logged against a plan
  // this one superseded — see getFeeSummaryForTenant.
  const payments = await prisma.payment.findMany({
    where: { tenantId, studentId },
    orderBy: { paidAt: "desc" },
    include: { collectedBy: { select: { name: true } }, corrections: { select: { id: true } } },
  });

  const { total, paid, balance } = computeBalance(plan, payments);
  return { plan: { ...plan, payments }, total, paid, balance };
}
