import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

/**
 * Writes an AuditLog row. Call this inside the same transaction as the
 * write it's recording — see PRD §6.10 / dev prompt §5: every write to
 * Payment, Attendance (after the marking day), FeePlan overrides, and KYC
 * verification status must be paired with an audit entry.
 */
export async function writeAuditLog(
  tx: TxClient,
  params: {
    tenantId: string;
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    diff?: Record<string, unknown>;
  },
) {
  await tx.auditLog.create({
    data: {
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      diff: params.diff as Prisma.InputJsonValue | undefined,
    },
  });
}
