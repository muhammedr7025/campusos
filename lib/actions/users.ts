"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { generateTempPassword, hashPassword } from "@/lib/auth-helpers";
import { createUserSchema, updateUserSchema } from "@/lib/validators/users";
import { actionError, type ActionResult } from "@/lib/actions/types";

export async function createStaffUser(input: unknown): Promise<ActionResult<{ email: string; password: string }>> {
  try {
    const session = await requirePermission("user:manage");
    const tenantId = await getTenantId();
    const data = createUserSchema.parse(input);

    const existing = await prisma.user.findUnique({ where: { tenantId_email: { tenantId, email: data.email } } });
    if (existing) return { ok: false, error: "A user with this email already exists." };

    const password = generateTempPassword();
    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { tenantId, email: data.email, name: data.name, phone: data.phone || null, role: data.role, passwordHash },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "User",
        entityId: created.id,
        diff: { email: data.email, role: data.role },
      });
      return created;
    });

    revalidatePath("/admin/users");
    return { ok: true, data: { email: user.email, password } };
  } catch (error) {
    return actionError(error);
  }
}

export async function setUserActive(userId: string, isActive: boolean): Promise<ActionResult> {
  try {
    const session = await requirePermission("user:manage");
    const tenantId = await getTenantId();

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirstOrThrow({ where: { id: userId, tenantId } });
      await tx.user.update({ where: { id: userId }, data: { isActive } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: isActive ? "ACTIVATE" : "DEACTIVATE",
        entityType: "User",
        entityId: userId,
        diff: { email: user.email },
      });
    });

    revalidatePath("/admin/users");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateStaffUser(userId: string, input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("user:manage");
    const tenantId = await getTenantId();
    const data = updateUserSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const before = await tx.user.findFirstOrThrow({ where: { id: userId, tenantId } });
      await tx.user.update({
        where: { id: userId },
        data: { name: data.name, phone: data.phone || null, role: data.role },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "User",
        entityId: userId,
        diff: { before: { name: before.name, role: before.role }, after: data },
      });
    });

    revalidatePath("/admin/users");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function resetStaffUserPassword(userId: string): Promise<ActionResult<{ password: string }>> {
  try {
    const session = await requirePermission("user:manage");
    const tenantId = await getTenantId();

    const password = generateTempPassword();
    const passwordHash = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirstOrThrow({ where: { id: userId, tenantId } });
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "RESET_PASSWORD",
        entityType: "User",
        entityId: userId,
        diff: { email: user.email },
      });
    });

    revalidatePath("/admin/users");
    return { ok: true, data: { password } };
  } catch (error) {
    return actionError(error);
  }
}
