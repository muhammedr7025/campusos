import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { BusinessRuleError } from "@/lib/actions/errors";

/**
 * Every id an action receives came from a browser. Tenant scoping on the
 * *write* isn't enough on its own: storing `courseId` under this tenant's row
 * happily succeeds when the id belongs to another institute, because the
 * foreign key only checks that the row exists somewhere.
 *
 * So each action states which references it was handed, and this checks them
 * all in one round trip before anything is written.
 */
export type OwnedRefs = Partial<{
  course: string | null;
  division: string | null;
  subject: string | null;
  student: string | null;
  feeStructure: string | null;
  lead: string | null;
  exam: string | null;
  /** A user in this tenant who must actually be a teacher. */
  teacher: string | null;
  /** Any user in this tenant, whatever their role. */
  user: string | null;
}>;

const LABELS: Record<keyof OwnedRefs, string> = {
  course: "course",
  division: "division",
  subject: "subject",
  student: "student",
  feeStructure: "fee structure",
  lead: "enquiry",
  exam: "exam",
  teacher: "teacher",
  user: "user",
};

function exists(kind: keyof OwnedRefs, tenantId: string, id: string): Promise<unknown> {
  switch (kind) {
    case "course":
      return prisma.course.findFirst({ where: { id, tenantId }, select: { id: true } });
    case "division":
      return prisma.division.findFirst({ where: { id, tenantId }, select: { id: true } });
    case "subject":
      return prisma.subject.findFirst({ where: { id, tenantId }, select: { id: true } });
    case "student":
      return prisma.student.findFirst({ where: { id, tenantId }, select: { id: true } });
    case "feeStructure":
      return prisma.feeStructure.findFirst({ where: { id, tenantId }, select: { id: true } });
    case "lead":
      return prisma.lead.findFirst({ where: { id, tenantId }, select: { id: true } });
    case "exam":
      return prisma.exam.findFirst({ where: { id, tenantId }, select: { id: true } });
    case "teacher":
      return prisma.user.findFirst({ where: { id, tenantId, role: Role.TEACHER }, select: { id: true } });
    case "user":
      return prisma.user.findFirst({ where: { id, tenantId }, select: { id: true } });
  }
}

/**
 * Throws unless every id given belongs to this tenant. Undefined, null and
 * empty entries are skipped, so optional references can be passed straight
 * through from a form.
 */
export async function assertOwned(tenantId: string, refs: OwnedRefs): Promise<void> {
  const checks = (Object.entries(refs) as [keyof OwnedRefs, string | null | undefined][]).filter(
    (entry): entry is [keyof OwnedRefs, string] => !!entry[1],
  );
  if (checks.length === 0) return;

  const found = await Promise.all(checks.map(([kind, id]) => exists(kind, tenantId, id)));
  const missingAt = found.findIndex((row) => row == null);
  if (missingAt >= 0) {
    const kind = checks[missingAt][0];
    throw new BusinessRuleError(
      kind === "teacher"
        ? "That teacher isn't part of this institute."
        : `That ${LABELS[kind]} isn't part of this institute.`,
    );
  }
}
