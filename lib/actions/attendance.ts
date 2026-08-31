"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { notifier } from "@/lib/notifications";
import { markAttendanceSchema, ATTENDANCE_ALERT_THRESHOLD } from "@/lib/validators/attendance";
import { actionError, type ActionResult } from "@/lib/actions/types";

async function checkAttendanceDropAndNotify(tenantId: string, studentId: string) {
  const records = await prisma.attendance.findMany({ where: { tenantId, studentId }, select: { status: true } });
  if (records.length < 5) return; // not enough history to be meaningful yet

  const present = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const percentage = Math.round((present / records.length) * 100);
  if (percentage >= ATTENDANCE_ALERT_THRESHOLD) return;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true, guardians: { include: { guardian: { include: { user: true } } } } },
  });
  if (!student) return;

  const recipients = [
    student.user?.id,
    ...student.guardians.map((sg) => sg.guardian.user?.id).filter((id): id is string => !!id),
  ].filter((id): id is string => !!id);

  await Promise.all(
    recipients.map((recipientId) =>
      notifier.send(tenantId, recipientId, "ATTENDANCE_DROP", {
        title: "Attendance below threshold",
        body: `${student.name}'s attendance is at ${percentage}%, below the ${ATTENDANCE_ALERT_THRESHOLD}% threshold.`,
        relatedEntityType: "Student",
        relatedEntityId: student.id,
      }),
    ),
  );
}

export async function markAttendance(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("attendance:mark");
    const tenantId = await getTenantId();
    const data = markAttendanceSchema.parse(input);
    const date = new Date(`${data.date}T00:00:00`);
    const today = new Date(new Date().toDateString());
    const isBackdated = date.getTime() !== today.getTime();

    await prisma.$transaction(async (tx) => {
      for (const entry of data.entries) {
        const existing = await tx.attendance.findUnique({
          where: { studentId_subjectId_date: { studentId: entry.studentId, subjectId: data.subjectId, date } },
        });

        if (existing) {
          if (existing.status === entry.status) continue;
          await tx.attendance.update({
            where: { id: existing.id },
            data: { status: entry.status, editedAt: new Date() },
          });
          await writeAuditLog(tx, {
            tenantId,
            actorId: session.user.id,
            action: "EDIT",
            entityType: "Attendance",
            entityId: existing.id,
            diff: { from: existing.status, to: entry.status, backdated: isBackdated },
          });
        } else {
          const created = await tx.attendance.create({
            data: {
              tenantId,
              studentId: entry.studentId,
              divisionId: data.divisionId,
              subjectId: data.subjectId,
              date,
              status: entry.status,
              markedById: session.user.id,
            },
          });
          if (isBackdated) {
            await writeAuditLog(tx, {
              tenantId,
              actorId: session.user.id,
              action: "CREATE_BACKDATED",
              entityType: "Attendance",
              entityId: created.id,
              diff: { status: entry.status, date: data.date },
            });
          }
        }
      }
    });

    await Promise.all(
      data.entries
        .filter((e) => e.status === "ABSENT")
        .map((e) => checkAttendanceDropAndNotify(tenantId, e.studentId)),
    );

    revalidatePath(`/teacher/attendance/${data.divisionId}`);
    revalidatePath("/portal/attendance");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
