"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { notifier } from "@/lib/notifications";
import { announcementSchema } from "@/lib/validators/announcements";
import { actionError, type ActionResult } from "@/lib/actions/types";
import { Role } from "@/generated/prisma/client";

const AUDIENCE_ROLES: Record<string, Role[] | undefined> = {
  EVERYONE: undefined,
  PARENTS: [Role.PARENT],
  STUDENTS: [Role.STUDENT],
  TEACHERS: [Role.TEACHER],
};

export async function createAnnouncement(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("announcement:manage");
    const tenantId = await getTenantId();
    const data = announcementSchema.parse(input);

    const announcement = await prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: { tenantId, title: data.title, body: data.body, audience: data.audience, authorId: session.user.id },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "Announcement",
        entityId: created.id,
        diff: { title: data.title, audience: data.audience },
      });
      return created;
    });

    const roles = AUDIENCE_ROLES[data.audience];
    const recipients = await prisma.user.findMany({
      where: { tenantId, isActive: true, ...(roles ? { role: { in: roles } } : {}) },
      select: { id: true },
    });

    await Promise.all(
      recipients.map((r) =>
        notifier.send(tenantId, r.id, "ANNOUNCEMENT", {
          title: `Announcement: ${data.title}`,
          body: data.body,
          relatedEntityType: "Announcement",
          relatedEntityId: announcement.id,
        }),
      ),
    );

    revalidatePath("/admin/announcements");
    revalidatePath("/portal/announcements");
    return { ok: true, data: { id: announcement.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("announcement:manage");
    const tenantId = await getTenantId();

    await prisma.$transaction(async (tx) => {
      const announcement = await tx.announcement.findFirstOrThrow({ where: { id, tenantId } });
      await tx.announcement.delete({ where: { id } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "DELETE",
        entityType: "Announcement",
        entityId: id,
        diff: { title: announcement.title },
      });
    });

    revalidatePath("/admin/announcements");
    revalidatePath("/portal/announcements");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
