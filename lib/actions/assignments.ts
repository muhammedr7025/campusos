"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { UPLOAD_RULES, uploadProblem } from "@/lib/storage/validate";
import { assertTeaches } from "@/lib/academics/teaching";
import { notifier } from "@/lib/notifications";
import {
  assignmentSchema,
  updateAssignmentSchema,
  gradeSubmissionSchema,
  submitAssignmentSchema,
} from "@/lib/validators/assignments";
import { Role } from "@/generated/prisma/client";
import { BusinessRuleError } from "@/lib/actions/errors";
import { assertOwned } from "@/lib/rbac/ownership";
import { actionError, type ActionResult } from "@/lib/actions/types";

export async function createAssignment(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("assignment:manage");
    const tenantId = await getTenantId();

    const data = assignmentSchema.parse({
      divisionId: formData.get("divisionId"),
      subjectId: formData.get("subjectId"),
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      dueDate: formData.get("dueDate"),
    });

    await assertOwned(tenantId, { division: data.divisionId, subject: data.subjectId });
    await assertTeaches(tenantId, session.user, data.divisionId, data.subjectId);

    const file = formData.get("attachment");
    let attachmentUrl: string | null = null;
    if (file instanceof File && file.size > 0) {
      const problem = uploadProblem(file, UPLOAD_RULES.document);
      if (problem) throw new BusinessRuleError(problem);
      const buffer = Buffer.from(await file.arrayBuffer());
      const stored = await storage.save({ tenantId, category: "assignments", buffer, filename: file.name, contentType: file.type });
      attachmentUrl = stored.url;
    }

    const students = await prisma.student.findMany({
      where: { tenantId, divisionId: data.divisionId, ...ENROLLED_STUDENT_WHERE },
      select: { id: true, userId: true, guardians: { include: { guardian: { select: { userId: true } } } } },
    });

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.assignment.create({
        data: {
          tenantId,
          divisionId: data.divisionId,
          subjectId: data.subjectId,
          teacherId: session.user.id,
          title: data.title,
          description: data.description || null,
          attachmentUrl,
          dueDate: new Date(data.dueDate),
        },
      });

      if (students.length > 0) {
        await tx.submission.createMany({
          data: students.map((s) => ({ tenantId, assignmentId: created.id, studentId: s.id })),
        });
      }

      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "Assignment",
        entityId: created.id,
        diff: { title: data.title, divisionId: data.divisionId },
      });

      return created;
    });

    const recipients = students.flatMap((s) => [s.userId, ...s.guardians.map((g) => g.guardian.userId)]).filter((id): id is string => !!id);
    await Promise.all(
      recipients.map((recipientId) =>
        notifier.send(tenantId, recipientId, "ASSIGNMENT_POSTED", {
          title: "New assignment posted",
          body: `${data.title} is due ${new Date(data.dueDate).toLocaleDateString()}.`,
          relatedEntityType: "Assignment",
          relatedEntityId: assignment.id,
        }),
      ),
    );

    revalidatePath("/teacher/assignments");
    revalidatePath("/portal/assignments");
    return { ok: true, data: { id: assignment.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function gradeSubmission(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("submission:grade");
    const tenantId = await getTenantId();
    const data = gradeSubmissionSchema.parse(input);

    const submission = await prisma.$transaction(async (tx) => {
      const existing = await tx.submission.findFirstOrThrow({
        where: { id: data.submissionId, tenantId },
        include: {
          student: { select: { userId: true } },
          assignment: { select: { title: true, teacherId: true, divisionId: true, subjectId: true } },
        },
      });
      // The assignment's author, or whoever teaches that class now.
      if (session.user.role !== Role.SUPER_ADMIN && existing.assignment.teacherId !== session.user.id) {
        await assertTeaches(tenantId, session.user, existing.assignment.divisionId, existing.assignment.subjectId);
      }
      if (existing.status === "MISSING") {
        throw new BusinessRuleError("Nothing has been submitted yet, so there's nothing to grade.");
      }

      const updated = await tx.submission.update({
        where: { id: existing.id },
        data: { grade: data.grade, feedback: data.feedback || null, status: "GRADED", gradedById: session.user.id, gradedAt: new Date() },
      });

      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "GRADE",
        entityType: "Submission",
        entityId: updated.id,
        diff: { grade: data.grade },
      });

      return existing;
    });

    if (submission.student.userId) {
      await notifier.send(tenantId, submission.student.userId, "ASSIGNMENT_GRADED", {
        title: "Assignment graded",
        body: `${submission.assignment.title} was graded: ${data.grade}.`,
        relatedEntityType: "Submission",
        relatedEntityId: data.submissionId,
      });
    }

    revalidatePath(`/teacher/assignments`);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function submitAssignment(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requirePermission("submission:create");
    const tenantId = await getTenantId();

    const data = submitAssignmentSchema.parse({
      submissionId: formData.get("submissionId"),
      text: formData.get("text") || undefined,
    });

    const submission = await prisma.submission.findFirstOrThrow({
      where: { id: data.submissionId, tenantId },
      include: { student: true, assignment: true },
    });
    if (submission.student.userId !== session.user.id) {
      return { ok: false, error: "You can only submit your own assignments." };
    }
    // A grade closes the submission — resubmitting used to quietly drop it
    // back to "submitted" with the old grade still attached.
    if (submission.status === "GRADED") {
      return { ok: false, error: "This assignment has already been graded and can't be resubmitted." };
    }

    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (!data.text?.trim() && !hasFile && !submission.fileUrl) {
      return { ok: false, error: "Write your answer or attach a file before submitting." };
    }

    let fileUrl: string | undefined;
    if (hasFile) {
      const problem = uploadProblem(file, UPLOAD_RULES.document);
      if (problem) return { ok: false, error: problem };
      const buffer = Buffer.from(await file.arrayBuffer());
      const stored = await storage.save({ tenantId, category: "submissions", buffer, filename: file.name, contentType: file.type });
      fileUrl = stored.url;
    }

    const isLate = new Date() > submission.assignment.dueDate;

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        text: data.text || submission.text,
        fileUrl: fileUrl ?? submission.fileUrl,
        status: isLate ? "LATE" : "SUBMITTED",
        submittedAt: new Date(),
      },
    });
    if (fileUrl && submission.fileUrl && submission.fileUrl !== fileUrl) {
      await storage.delete(submission.fileUrl).catch(() => {});
    }

    revalidatePath("/portal/assignments");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateAssignment(assignmentId: string, input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("assignment:manage");
    const tenantId = await getTenantId();
    const data = updateAssignmentSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const before = await tx.assignment.findFirstOrThrow({ where: { id: assignmentId, tenantId } });
      if (session.user.role !== Role.SUPER_ADMIN && before.teacherId !== session.user.id) {
        throw new BusinessRuleError("You can only edit assignments you created.");
      }

      await tx.assignment.update({
        where: { id: assignmentId },
        data: { title: data.title, description: data.description || null, dueDate: new Date(data.dueDate) },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "Assignment",
        entityId: assignmentId,
        diff: { before: { title: before.title, dueDate: before.dueDate }, after: data },
      });
    });

    revalidatePath("/teacher/assignments");
    revalidatePath(`/teacher/assignments/${assignmentId}/submissions`);
    revalidatePath("/portal/assignments");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteAssignment(assignmentId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("assignment:manage");
    const tenantId = await getTenantId();

    const assignment = await prisma.assignment.findFirstOrThrow({ where: { id: assignmentId, tenantId } });
    if (session.user.role !== Role.SUPER_ADMIN && assignment.teacherId !== session.user.id) {
      return { ok: false, error: "You can only delete assignments you created." };
    }

    const files = await prisma.submission.findMany({
      where: { assignmentId, tenantId, fileUrl: { not: null } },
      select: { fileUrl: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.submission.deleteMany({ where: { assignmentId, tenantId } });
      await tx.assignment.delete({ where: { id: assignmentId } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "DELETE",
        entityType: "Assignment",
        entityId: assignmentId,
        diff: { title: assignment.title },
      });
    });

    // The rows are gone, so the files have no owner left.
    for (const url of [assignment.attachmentUrl, ...files.map((f) => f.fileUrl)]) {
      if (url) await storage.delete(url).catch(() => {});
    }

    revalidatePath("/teacher/assignments");
    revalidatePath("/portal/assignments");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
