import { prisma } from "@/lib/prisma";
import type { StudentStatus } from "@/generated/prisma/client";

/**
 * One definition of "enrolled", so a course, a division and the institute
 * dashboard never disagree about how many students there are.
 *
 * A student awaiting KYC is already admitted — they hold a seat and carry a
 * fee plan — so they count. An inactive student (alumnus, withdrawn) does not,
 * which also stops a past cohort from permanently occupying division capacity.
 */
export const ENROLLED_STUDENT_STATUSES = ["KYC_PENDING", "ACTIVE"] as const;

export const ENROLLED_STUDENT_WHERE: { status: { in: StudentStatus[] } } = {
  status: { in: [...ENROLLED_STUDENT_STATUSES] },
};

export async function countEnrolledStudents(tenantId: string): Promise<number> {
  return prisma.student.count({ where: { tenantId, ...ENROLLED_STUDENT_WHERE } });
}
