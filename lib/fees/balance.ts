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

export async function getFeeSummaryForTenant(tenantId: string, filters?: { courseId?: string; divisionId?: string }): Promise<FeePlanSummary[]> {
  const plans = await prisma.feePlan.findMany({
    where: {
      tenantId,
      student: {
        ...(filters?.courseId ? { courseId: filters.courseId } : {}),
        ...(filters?.divisionId ? { divisionId: filters.divisionId } : {}),
      },
    },
    include: {
      installments: true,
      payments: true,
      student: { select: { id: true, name: true, enrollmentNumber: true } },
    },
  });

  const today = new Date();

  return plans.map((plan) => {
    const { total, paid, balance } = computeBalance(plan, plan.payments);
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
      payments: { orderBy: { paidAt: "desc" }, include: { collectedBy: { select: { name: true } } } },
      student: true,
      approvedBy: { select: { name: true } },
    },
  });
  if (!plan) return null;

  const { total, paid, balance } = computeBalance(plan, plan.payments);
  return { plan, total, paid, balance };
}
