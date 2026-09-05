"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { notifier } from "@/lib/notifications";
import { examSchema, recordMarkSchema } from "@/lib/validators/exams";
import { actionError, type ActionResult } from "@/lib/actions/types";

export async function createExam(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("exam:manage");
    const tenantId = await getTenantId();
    const data = examSchema.parse(input);

    const exam = await prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          tenantId,
          divisionId: data.divisionId,
          subjectId: data.subjectId,
          name: data.name,
          date: new Date(data.date),
          time: data.time || null,
          maxMarks: data.maxMarks,
          syllabus: data.syllabus || null,
          createdById: session.user.id,
        },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "Exam",
        entityId: created.id,
        diff: { name: data.name, divisionId: data.divisionId },
      });
      return created;
    });

    revalidatePath("/teacher/exams");
    return { ok: true, data: { id: exam.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteExam(id: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("exam:manage");
    const tenantId = await getTenantId();

    await prisma.$transaction(async (tx) => {
      const exam = await tx.exam.findFirstOrThrow({ where: { id, tenantId } });
      await tx.exam.delete({ where: { id } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "DELETE",
        entityType: "Exam",
        entityId: id,
        diff: { name: exam.name },
      });
    });

    revalidatePath("/teacher/exams");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function recordMark(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("exam:manage");
    const tenantId = await getTenantId();
    const data = recordMarkSchema.parse(input);

    const exam = await prisma.exam.findFirstOrThrow({ where: { id: data.examId, tenantId } });
    if (data.score > exam.maxMarks) {
      return { ok: false, error: `Score can't exceed ${exam.maxMarks}.` };
    }

    const student = await prisma.student.findFirstOrThrow({
      where: { id: data.studentId, tenantId },
      include: { user: true, guardians: { include: { guardian: { include: { user: true } } } } },
    });

    await prisma.$transaction(async (tx) => {
      const mark = await tx.mark.upsert({
        where: { examId_studentId: { examId: data.examId, studentId: data.studentId } },
        update: { score: data.score, gradedById: session.user.id },
        create: { tenantId, examId: data.examId, studentId: data.studentId, score: data.score, gradedById: session.user.id },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "RECORD_MARK",
        entityType: "Mark",
        entityId: mark.id,
        diff: { examId: data.examId, studentId: data.studentId, score: data.score },
      });
    });

    const recipients = [
      student.user?.id,
      ...student.guardians.map((sg) => sg.guardian.user?.id).filter((id): id is string => !!id),
    ].filter((id): id is string => !!id);

    await Promise.all(
      recipients.map((recipientId) =>
        notifier.send(tenantId, recipientId, "EXAM_RESULT_PUBLISHED", {
          title: "Exam result published",
          body: `${exam.name}: ${data.score}/${exam.maxMarks}.`,
          relatedEntityType: "Exam",
          relatedEntityId: exam.id,
        }),
      ),
    );

    revalidatePath(`/teacher/exams/${data.examId}`);
    revalidatePath("/portal/exams");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
