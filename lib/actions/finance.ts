"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { notifier } from "@/lib/notifications";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";
import {
  feeStructureSchema,
  paymentSchema,
  paymentCorrectionSchema,
  feePlanOverrideSchema,
} from "@/lib/validators/finance";
import { actionError, type ActionResult } from "@/lib/actions/types";
import type { Prisma } from "@/generated/prisma/client";

export async function createFeeStructure(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("fee-structure:manage");
    const tenantId = await getTenantId();
    const data = feeStructureSchema.parse(input);

    const totalAmount = data.installments.reduce((sum, i) => sum + i.amount, 0);

    const structure = await prisma.$transaction(async (tx) => {
      const created = await tx.feeStructure.create({
        data: {
          tenantId,
          courseId: data.courseId,
          name: data.name,
          totalAmount,
          lateFeeType: data.lateFeeType,
          lateFeeValue: data.lateFeeValue,
          gracePeriodDays: data.gracePeriodDays,
          installments: {
            create: data.installments.map((i, idx) => ({
              label: i.label,
              amount: i.amount,
              dueDate: new Date(i.dueDate),
              sequence: idx + 1,
            })),
          },
        },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "FeeStructure",
        entityId: created.id,
        diff: { name: data.name, totalAmount },
      });
      return created;
    });

    revalidatePath("/finance/fee-structures");
    return { ok: true, data: { id: structure.id } };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Next receipt number for a tenant, e.g. RCP-0007. Derived from the highest
 * existing number rather than a row count, so deleting nothing and reversing
 * anything can't hand out a number twice. The unique index on
 * (tenantId, receiptNumber) is the real backstop.
 */
async function nextReceiptNumber(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const latest = await tx.payment.findFirst({
    where: { tenantId, correctionOfId: null, receiptNumber: { startsWith: "RCP-" } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });
  const previous = latest?.receiptNumber ? Number.parseInt(latest.receiptNumber.slice(4), 10) : 0;
  return `RCP-${String((Number.isNaN(previous) ? 0 : previous) + 1).padStart(4, "0")}`;
}

export async function logPayment(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("payment:create");
    const tenantId = await getTenantId();
    const data = paymentSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const plan = await tx.feePlan.findFirstOrThrow({
        where: { id: data.feePlanId, tenantId, studentId: data.studentId },
        include: { installments: { select: { id: true } } },
      });

      if (data.installmentId && !plan.installments.some((i) => i.id === data.installmentId)) {
        throw new Error("That installment doesn't belong to this student's fee plan.");
      }

      // Balance is derived, never stored — so the guard recomputes it here
      // rather than trusting anything the client sent. Payments are summed per
      // student, not per plan: an approved discount supersedes the plan, and
      // money paid under the old one still counts (see getFeeSummaryForTenant).
      const priorPayments = await tx.payment.findMany({
        where: { tenantId, studentId: data.studentId },
        select: { amount: true },
      });
      const paid = priorPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const outstanding = Number(plan.totalAmount) - paid;
      if (data.amount > outstanding) {
        throw new Error(
          outstanding <= 0
            ? "This fee plan is already settled in full."
            : `That's more than the ₹${outstanding.toLocaleString("en-IN")} outstanding on this plan.`,
        );
      }

      const payment = await tx.payment.create({
        data: {
          tenantId,
          studentId: data.studentId,
          feePlanId: data.feePlanId,
          installmentId: data.installmentId || null,
          amount: data.amount,
          mode: data.mode,
          paidAt: new Date(data.paidAt),
          collectedById: session.user.id,
          note: data.note || null,
          receiptNumber: await nextReceiptNumber(tx, tenantId),
        },
      });

      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "Payment",
        entityId: payment.id,
        diff: { amount: data.amount, mode: data.mode },
      });
    });

    revalidatePath(`/finance/payments/${data.studentId}`);
    revalidatePath("/finance/dues");
    revalidatePath("/finance/payments");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Payments are append-only — this never UPDATEs an existing row's amount.
 * It writes a new correction row referencing the original, whose amount is
 * the *delta* needed to reach the corrected total (so SUM(amount) across
 * both rows still equals the true paid amount).
 */
export async function correctPayment(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("payment:correct");
    const tenantId = await getTenantId();
    const data = paymentCorrectionSchema.parse(input);

    const studentId = await prisma.$transaction(async (tx) => {
      const original = await tx.payment.findFirstOrThrow({
        where: { id: data.paymentId, tenantId },
        include: { corrections: { select: { id: true } } },
      });

      // A correction is itself a ledger row; correcting one would make the
      // trail impossible to read. Correct the original again instead.
      if (original.correctionOfId) {
        throw new Error("This entry is already a correction. Correct the original receipt instead.");
      }
      if (original.corrections.length > 0) {
        throw new Error("This payment has already been corrected. Log a new payment if more was collected.");
      }
      if (data.correctedAmount < 0) {
        throw new Error("A corrected amount can't be negative.");
      }

      const delta = data.correctedAmount - Number(original.amount);

      const correction = await tx.payment.create({
        data: {
          tenantId,
          studentId: original.studentId,
          feePlanId: original.feePlanId,
          installmentId: original.installmentId,
          amount: delta,
          mode: original.mode,
          paidAt: new Date(),
          collectedById: session.user.id,
          note: data.note,
          correctionOfId: original.id,
          receiptNumber: original.receiptNumber ? `${original.receiptNumber}-R` : null,
        },
      });

      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CORRECT",
        entityType: "Payment",
        entityId: correction.id,
        diff: { correctionOfId: original.id, originalAmount: Number(original.amount), correctedAmount: data.correctedAmount, delta },
      });

      return original.studentId;
    });

    revalidatePath(`/finance/payments/${studentId}`);
    revalidatePath("/finance/dues");
    revalidatePath("/finance/payments");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function createFeePlanOverride(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("fee-plan:override");
    const tenantId = await getTenantId();
    const data = feePlanOverrideSchema.parse(input);

    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.feePlan.create({
        data: {
          tenantId,
          studentId: data.studentId,
          totalAmount: data.totalAmount,
          overrideReason: data.overrideReason,
          approvedById: session.user.id,
          installments: {
            create: data.installments.map((i, idx) => ({
              label: i.label,
              amount: i.amount,
              dueDate: new Date(i.dueDate),
              sequence: idx + 1,
            })),
          },
        },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE_OVERRIDE",
        entityType: "FeePlan",
        entityId: created.id,
        diff: { totalAmount: data.totalAmount, reason: data.overrideReason },
      });
      return created;
    });

    revalidatePath(`/finance/payments/${data.studentId}`);
    return { ok: true, data: { id: plan.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateFeeStructure(feeStructureId: string, input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("fee-structure:manage");
    const tenantId = await getTenantId();
    const data = feeStructureSchema.parse(input);

    const totalAmount = data.installments.reduce((sum, i) => sum + i.amount, 0);

    await prisma.$transaction(async (tx) => {
      const before = await tx.feeStructure.findFirstOrThrow({ where: { id: feeStructureId, tenantId } });

      await tx.feeStructure.update({
        where: { id: feeStructureId },
        data: {
          courseId: data.courseId,
          name: data.name,
          totalAmount,
          lateFeeType: data.lateFeeType,
          lateFeeValue: data.lateFeeValue,
          gracePeriodDays: data.gracePeriodDays,
        },
      });

      // Installment templates only affect *future* fee plans (each FeePlan
      // copies its own installments at admission time), so replacing them
      // outright is safe — it never touches an already-generated FeePlan.
      await tx.feeInstallmentTemplate.deleteMany({ where: { feeStructureId } });
      await tx.feeInstallmentTemplate.createMany({
        data: data.installments.map((i, idx) => ({
          feeStructureId,
          label: i.label,
          amount: i.amount,
          dueDate: new Date(i.dueDate),
          sequence: idx + 1,
        })),
      });

      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "FeeStructure",
        entityId: feeStructureId,
        diff: { before: { name: before.name, totalAmount: Number(before.totalAmount) }, after: { name: data.name, totalAmount } },
      });
    });

    revalidatePath("/finance/fee-structures");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteFeeStructure(feeStructureId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("fee-structure:manage");
    const tenantId = await getTenantId();

    const structure = await prisma.feeStructure.findFirstOrThrow({
      where: { id: feeStructureId, tenantId },
      include: { _count: { select: { feePlans: true } } },
    });

    if (structure._count.feePlans > 0) {
      return { ok: false, error: "Can't delete a fee structure already linked to student fee plans." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.feeInstallmentTemplate.deleteMany({ where: { feeStructureId } });
      await tx.feeStructure.delete({ where: { id: feeStructureId } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "DELETE",
        entityType: "FeeStructure",
        entityId: feeStructureId,
        diff: { name: structure.name },
      });
    });

    revalidatePath("/finance/fee-structures");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function sendFeeReminder(studentId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("payment:create");
    const tenantId = await getTenantId();

    const student = await prisma.student.findFirstOrThrow({
      where: { id: studentId, tenantId },
      include: { user: true, guardians: { include: { guardian: { include: { user: true } } } } },
    });

    const recipients = [
      student.user?.id,
      ...student.guardians.map((sg) => sg.guardian.user?.id).filter((id): id is string => !!id),
    ].filter((id): id is string => !!id);

    await Promise.all(
      recipients.map((recipientId) =>
        notifier.send(tenantId, recipientId, "FEE_OVERDUE", {
          title: "Fee reminder",
          body: `A payment reminder was sent for ${student.name}'s outstanding fee balance.`,
          relatedEntityType: "Student",
          relatedEntityId: student.id,
        }),
      ),
    );

    await prisma.auditLog.create({
      data: {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "Reminder",
        entityId: student.id,
        diff: { studentName: student.name },
      },
    });

    revalidatePath("/finance/reminders");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function sendBulkOverdueReminders(): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await requirePermission("payment:create");
    const tenantId = await getTenantId();

    const overduePlans = await getFeeSummaryForTenant(tenantId);
    const overdueStudentIds = overduePlans.filter((p) => p.isOverdue).map((p) => p.studentId);
    if (overdueStudentIds.length === 0) {
      return { ok: true, data: { count: 0 } };
    }

    const students = await prisma.student.findMany({
      where: { id: { in: overdueStudentIds }, tenantId },
      include: { user: true, guardians: { include: { guardian: { include: { user: true } } } } },
    });

    await Promise.all(
      students.map((student) => {
        const recipients = [
          student.user?.id,
          ...student.guardians.map((sg) => sg.guardian.user?.id).filter((id): id is string => !!id),
        ].filter((id): id is string => !!id);
        return Promise.all(
          recipients.map((recipientId) =>
            notifier.send(tenantId, recipientId, "FEE_OVERDUE", {
              title: "Fee reminder",
              body: `A payment reminder was sent for ${student.name}'s outstanding fee balance.`,
              relatedEntityType: "Student",
              relatedEntityId: student.id,
            }),
          ),
        );
      }),
    );

    await prisma.auditLog.create({
      data: {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "ReminderBatch",
        entityId: `batch-${Date.now()}`,
        diff: { count: students.length },
      },
    });

    revalidatePath("/finance/reminders");
    return { ok: true, data: { count: students.length } };
  } catch (error) {
    return actionError(error);
  }
}
