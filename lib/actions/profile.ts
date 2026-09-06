"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requireSession } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { changePasswordSchema } from "@/lib/validators/profile";
import { actionError, type ActionResult } from "@/lib/actions/types";

export async function changeOwnPassword(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const tenantId = await getTenantId();
    const data = changePasswordSchema.parse(input);

    const user = await prisma.user.findFirstOrThrow({ where: { id: session.user.id, tenantId } });
    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) {
      return { ok: false, error: "Current password is incorrect." };
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CHANGE_OWN_PASSWORD",
        entityType: "User",
        entityId: user.id,
      });
    });

    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
