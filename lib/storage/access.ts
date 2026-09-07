import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentFeePlanForStudent } from "@/lib/fees/balance";
import { Role } from "@/generated/prisma/client";

export type StoredFileViewer = { id: string; role: Role };

/**
 * Per-category read policy for stored files. Tenant isolation is checked by
 * the caller; this adds the rules a URL alone would otherwise bypass —
 * notably the notes fee-lock, which the portal page enforces visually and
 * which a student could otherwise walk around by opening the file URL.
 */
export async function canReadStoredFile({
  tenantId,
  category,
  url,
  viewer,
}: {
  tenantId: string;
  category: string;
  url: string;
  viewer: StoredFileViewer;
}): Promise<boolean> {
  if (category !== "notes") return true;
  if (viewer.role !== Role.STUDENT) return true;

  const student = await prisma.student.findFirst({
    where: { tenantId, userId: viewer.id },
    select: { id: true, courseId: true },
  });
  if (!student) return false;

  const note = await prisma.subjectNote.findFirst({
    where: { tenantId, fileUrl: url },
    select: { courseId: true },
  });
  // Not a note attachment (or already deleted) — nothing to grant access to.
  if (!note) return false;
  if (note.courseId !== student.courseId) return false;

  const fees = await getCurrentFeePlanForStudent(tenantId, student.id);
  return !fees || fees.balance <= 0;
}
