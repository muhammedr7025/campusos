"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { subjectNoteSchema } from "@/lib/validators/notes";
import { actionError, type ActionResult } from "@/lib/actions/types";

export async function createSubjectNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("note:manage");
    const tenantId = await getTenantId();
    const data = subjectNoteSchema.parse(input);

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
          authorId: session.user.id,
        },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "SubjectNote",
        entityId: created.id,
        diff: { title: data.title, courseId: data.courseId },
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

    await prisma.$transaction(async (tx) => {
      const note = await tx.subjectNote.findFirstOrThrow({ where: { id, tenantId } });
      await tx.subjectNote.delete({ where: { id } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "DELETE",
        entityType: "SubjectNote",
        entityId: id,
        diff: { title: note.title },
      });
    });

    revalidatePath("/teacher/notes");
    revalidatePath("/portal/notes");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
