"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentFeePlanForStudent } from "@/lib/fees/balance";
import { discountRequestSchema } from "@/lib/validators/discounts";
import { assertOwned } from "@/lib/rbac/ownership";
import { actionError, type ActionResult } from "@/lib/actions/types";

export async function requestDiscount(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("discount:request");
    const tenantId = await getTenantId();
    const data = discountRequestSchema.parse(input);

    await assertOwned(tenantId, { student: data.studentId });

    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.discountRequest.create({
        data: {
          tenantId,
          studentId: data.studentId,
          kind: data.kind,
          amount: data.amount,
          reason: data.reason,
          requestedById: session.user.id,
        },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "DiscountRequest",
        entityId: created.id,
        diff: { kind: data.kind, amount: data.amount },
      });
      return created;
    });

    revalidatePath("/finance/discounts");
    return { ok: true, data: { id: request.id } };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Approval reduces the fee STRUCTURE (a new FeePlan, via the same
 * mechanism lib/actions/finance.ts#createFeePlanOverride already uses),
 * never the balance field directly — balance stays fully derived. Only a
 * Super Admin can approve; Finance can only request.
 */
export async function decideDiscount(discountId: string, approve: boolean): Promise<ActionResult> {
  try {
    const session = await requirePermission("discount:decide");
    const tenantId = await getTenantId();

    const request = await prisma.discountRequest.findFirstOrThrow({ where: { id: discountId, tenantId } });
    if (request.status !== "PENDING") {
      return { ok: false, error: "This request has already been decided." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.discountRequest.update({
        where: { id: discountId },
        data: { status: approve ? "APPROVED" : "REJECTED", decidedById: session.user.id, decidedAt: new Date() },
      });

      if (approve) {
        const current = await getCurrentFeePlanForStudent(tenantId, request.studentId);
        if (current) {
          const discount = Number(request.amount);
          const newTotal = Math.max(0, current.total - discount);
          let remaining = discount;
          const installments = current.plan.installments
            .slice()
            .reverse()
            .map((i) => {
              const amount = Number(i.amount);
              const reduceBy = Math.min(remaining, amount);
              remaining -= reduceBy;
              return { label: i.label, amount: Math.max(0, amount - reduceBy), dueDate: i.dueDate };
            })
            .reverse();

          await tx.feePlan.create({
            data: {
              tenantId,
              studentId: request.studentId,
              feeStructureId: current.plan.feeStructureId,
              totalAmount: newTotal,
              overrideReason: `${request.kind}: ${request.reason}`,
              approvedById: session.user.id,
              installments: {
                create: installments.map((i, idx) => ({ label: i.label, amount: i.amount, dueDate: i.dueDate, sequence: idx + 1 })),
              },
            },
          });
        }
      }

      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: approve ? "APPROVED" : "REJECTED",
        entityType: "DiscountRequest",
        entityId: discountId,
        diff: { kind: request.kind, amount: Number(request.amount) },
      });
    });

    revalidatePath("/finance/discounts");
    revalidatePath(`/finance/payments/${request.studentId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
