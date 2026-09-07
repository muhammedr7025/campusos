"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { timetableSchema, type TimetableInput } from "@/lib/validators/timetable";
import { assertOwned } from "@/lib/rbac/ownership";
import { actionError, type ActionResult } from "@/lib/actions/types";

/**
 * A slot can clash three ways, and only the teacher was ever checked: a
 * division booked twice over means the students are due in two places at
 * once, and a room booked twice means one of the two classes has nowhere to
 * sit. `excludeId` is how an edit avoids clashing with itself.
 */
async function findClash(
  tenantId: string,
  data: TimetableInput,
  excludeId?: string,
): Promise<string | null> {
  const sameSlot = {
    tenantId,
    dayOfWeek: data.dayOfWeek,
    ...(excludeId ? { id: { not: excludeId } } : {}),
    // Half-open intervals, so 09:00-10:00 and 10:00-11:00 don't count as
    // overlapping.
    AND: [{ startTime: { lt: data.endTime } }, { endTime: { gt: data.startTime } }],
  };

  const [teacherClash, divisionClash, roomClash] = await Promise.all([
    prisma.timetable.findFirst({ where: { ...sameSlot, teacherId: data.teacherId } }),
    prisma.timetable.findFirst({ where: { ...sameSlot, divisionId: data.divisionId } }),
    data.room ? prisma.timetable.findFirst({ where: { ...sameSlot, room: data.room } }) : null,
  ]);

  if (teacherClash) return "This teacher is already scheduled during that time slot.";
  if (divisionClash) return "This division already has a class during that time slot.";
  if (roomClash) return `Room ${data.room} is already booked during that time slot.`;
  return null;
}

export async function createTimetableEntry(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("timetable:manage");
    const tenantId = await getTenantId();
    const data = timetableSchema.parse(input);

    await assertOwned(tenantId, { division: data.divisionId, subject: data.subjectId, teacher: data.teacherId });

    const clash = await findClash(tenantId, data);
    if (clash) return { ok: false, error: clash };

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

    const clash = await findClash(tenantId, data, id);
    if (clash) return { ok: false, error: clash };

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
