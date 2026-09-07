"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { subjectNoteSchema } from "@/lib/validators/notes";
import { actionError, type ActionResult } from "@/lib/actions/types";

const MAX_NOTE_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_NOTE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

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

    if (file) {
      if (!ALLOWED_NOTE_TYPES.includes(file.type)) {
        return { ok: false, error: "Attach a PDF or an image." };
      }
      if (file.size > MAX_NOTE_FILE_BYTES) {
        return { ok: false, error: "That file is over the 20 MB limit." };
      }
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
