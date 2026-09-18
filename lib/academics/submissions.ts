import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Gives a student a submission row for every assignment already posted to
 * the division they're joining. Rows are otherwise only created when an
 * assignment is posted, so anyone admitted or moved in afterwards never saw
 * it — not on their portal, not on the teacher's list.
 */
export async function syncSubmissionsForStudent(tx: Tx, tenantId: string, studentId: string, divisionId: string): Promise<number> {
  const [assignments, existing] = await Promise.all([
    tx.assignment.findMany({ where: { tenantId, divisionId }, select: { id: true } }),
    tx.submission.findMany({ where: { tenantId, studentId }, select: { assignmentId: true } }),
  ]);
  const have = new Set(existing.map((s) => s.assignmentId));
  const missing = assignments.filter((a) => !have.has(a.id));
  if (missing.length === 0) return 0;

  await tx.submission.createMany({
    data: missing.map((a) => ({ tenantId, assignmentId: a.id, studentId })),
    skipDuplicates: true,
  });
  return missing.length;
}
