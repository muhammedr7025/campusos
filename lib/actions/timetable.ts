"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { timetableSchema } from "@/lib/validators/timetable";
import { assertOwned } from "@/lib/rbac/ownership";
import { actionError, type ActionResult } from "@/lib/actions/types";

export async function createTimetableEntry(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("timetable:manage");
    const tenantId = await getTenantId();
    const data = timetableSchema.parse(input);

    await assertOwned(tenantId, { division: data.divisionId, subject: data.subjectId, teacher: data.teacherId });

    // Flag double-booking a teacher at creation time (PRD §6.7 acceptance criteria).
    const overlapping = await prisma.timetable.findFirst({
      where: {
        tenantId,
        teacherId: data.teacherId,
        dayOfWeek: data.dayOfWeek,
        AND: [{ startTime: { lt: data.endTime } }, { endTime: { gt: data.startTime } }],
      },
    });
    if (overlapping) {
      return { ok: false, error: "This teacher is already scheduled during that time slot." };
    }

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.timetable.create({ data: { tenantId, ...data } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "Timetable",
        entityId: created.id,
        diff: data,
      });
      return created;
    });

    revalidatePath("/admin/timetable");
    revalidatePath("/teacher/timetable");
    return { ok: true, data: { id: entry.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateTimetableEntry(id: string, input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("timetable:manage");
    const tenantId = await getTenantId();
    const data = timetableSchema.parse(input);

    await assertOwned(tenantId, { division: data.divisionId, subject: data.subjectId, teacher: data.teacherId });

    const overlapping = await prisma.timetable.findFirst({
      where: {
        tenantId,
        teacherId: data.teacherId,
        dayOfWeek: data.dayOfWeek,
        id: { not: id },
        AND: [{ startTime: { lt: data.endTime } }, { endTime: { gt: data.startTime } }],
      },
    });
    if (overlapping) {
      return { ok: false, error: "This teacher is already scheduled during that time slot." };
    }

    await prisma.$transaction(async (tx) => {
      const before = await tx.timetable.findFirstOrThrow({ where: { id, tenantId } });
      await tx.timetable.update({ where: { id }, data });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "Timetable",
        entityId: id,
        diff: { before: { dayOfWeek: before.dayOfWeek, startTime: before.startTime, endTime: before.endTime }, after: data },
      });
    });

    revalidatePath("/admin/timetable");
    revalidatePath("/teacher/timetable");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteTimetableEntry(id: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("timetable:manage");
    const tenantId = await getTenantId();

    await prisma.$transaction(async (tx) => {
      const entry = await tx.timetable.findFirstOrThrow({ where: { id, tenantId } });
      await tx.timetable.delete({ where: { id } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "DELETE",
        entityType: "Timetable",
        entityId: id,
        diff: { divisionId: entry.divisionId, subjectId: entry.subjectId },
      });
    });

    revalidatePath("/admin/timetable");
    revalidatePath("/teacher/timetable");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
