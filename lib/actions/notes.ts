"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, PDF_TYPE, uploadProblem } from "@/lib/storage/validate";
import { subjectNoteSchema } from "@/lib/validators/notes";
import { assertOwned } from "@/lib/rbac/ownership";
import { actionError, type ActionResult } from "@/lib/actions/types";
import { BusinessRuleError } from "@/lib/actions/errors";
import { Role } from "@/generated/prisma/client";

const NOTE_UPLOAD_RULE = { types: [PDF_TYPE, ...IMAGE_TYPES], maxBytes: MAX_UPLOAD_BYTES, describe: "a PDF or an image" };

/**
 * Takes a FormData rather than a plain object because the note can carry a
 * file. Everything else is unchanged — the same validator runs on the fields
 * once they're pulled out.
 */
export async function createSubjectNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("note:manage");
    const tenantId = await getTenantId();

    let file: File | null = null;
    let fields: unknown = input;

    if (input instanceof FormData) {
      const maybeFile = input.get("file");
      file = maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : null;
      const pages = String(input.get("pages") ?? "");
      fields = {
        courseId: String(input.get("courseId") ?? ""),
        subjectId: String(input.get("subjectId") ?? ""),
        title: String(input.get("title") ?? ""),
        kind: String(input.get("kind") ?? "CLASS_NOTES"),
        text: String(input.get("text") ?? ""),
        pages: pages === "" ? undefined : Number(pages),
      };
    }

    const data = subjectNoteSchema.parse(fields);

    await assertOwned(tenantId, { course: data.courseId, subject: data.subjectId });
    const subject = await prisma.subject.findFirst({ where: { id: data.subjectId, tenantId, courseId: data.courseId }, select: { id: true } });
    if (!subject) return { ok: false, error: "That subject isn't part of the selected course." };
    // A teacher publishes for subjects they teach somewhere in the course.
    if (session.user.role !== Role.SUPER_ADMIN) {
      const teaches = await prisma.timetable.findFirst({
        where: { tenantId, teacherId: session.user.id, subjectId: data.subjectId },
        select: { id: true },
      });
      if (!teaches) return { ok: false, error: "You can only publish notes for a subject you teach." };
    }

    if (file) {
      const problem = uploadProblem(file, NOTE_UPLOAD_RULE);
      if (problem) return { ok: false, error: problem };
    }

    // Stored before the transaction so a slow upload doesn't hold a database
    // transaction open; an orphaned file is harmless, a half-written note isn't.
    const stored = file
      ? await storage.save({
          tenantId,
          category: "notes",
          buffer: Buffer.from(await file.arrayBuffer()),
          filename: file.name,
          contentType: file.type,
        })
      : null;

    const note = await prisma.$transaction(async (tx) => {
      const created = await tx.subjectNote.create({
        data: {
          tenantId,
          courseId: data.courseId,
          subjectId: data.subjectId,
          title: data.title,
          kind: data.kind,
          text: data.text || null,
          pages: data.pages ?? null,
          fileUrl: stored?.url ?? null,
          authorId: session.user.id,
        },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "SubjectNote",
        entityId: created.id,
        diff: { title: data.title, courseId: data.courseId, hasFile: stored != null },
      });
      return created;
    });

    revalidatePath("/teacher/notes");
    revalidatePath("/portal/notes");
    return { ok: true, data: { id: note.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteSubjectNote(id: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("note:manage");
    const tenantId = await getTenantId();

    const fileUrl = await prisma.$transaction(async (tx) => {
      const note = await tx.subjectNote.findFirstOrThrow({ where: { id, tenantId } });
      if (session.user.role !== Role.SUPER_ADMIN && note.authorId !== session.user.id) {
        throw new BusinessRuleError("You can only delete notes you published.");
      }
      await tx.subjectNote.delete({ where: { id } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "DELETE",
        entityType: "SubjectNote",
        entityId: id,
        diff: { title: note.title },
      });
      return note.fileUrl;
    });
    if (fileUrl) await storage.delete(fileUrl).catch(() => {});

    revalidatePath("/teacher/notes");
    revalidatePath("/portal/notes");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
