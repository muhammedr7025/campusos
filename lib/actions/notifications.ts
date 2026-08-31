"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requireSession } from "@/lib/rbac/guard";
import { actionError, type ActionResult } from "@/lib/actions/types";

export async function markNotificationRead(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const tenantId = await getTenantId();
    await prisma.notification.updateMany({
      where: { id, tenantId, recipientId: session.user.id },
      data: { isRead: true },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const tenantId = await getTenantId();
    await prisma.notification.updateMany({
      where: { tenantId, recipientId: session.user.id, isRead: false },
      data: { isRead: true },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
