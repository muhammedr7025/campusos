import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";

export type PortalStudent = {
  id: string;
  name: string;
  enrollmentNumber: string;
  courseId: string;
  divisionId: string | null;
  courseName: string;
  divisionName: string | null;
};

export async function getPortalStudents(tenantId: string, userId: string, role: Role): Promise<PortalStudent[]> {
  if (role === Role.STUDENT) {
    const student = await prisma.student.findFirst({
      where: { tenantId, userId },
      include: { course: true, division: true },
    });
    if (!student) return [];
    return [
      {
        id: student.id,
        name: student.name,
        enrollmentNumber: student.enrollmentNumber,
        courseId: student.courseId,
        divisionId: student.divisionId,
        courseName: student.course.name,
        divisionName: student.division?.name ?? null,
      },
    ];
  }

  const guardian = await prisma.parentGuardian.findFirst({
    where: { tenantId, userId },
    include: { students: { include: { student: { include: { course: true, division: true } } } } },
  });
  if (!guardian) return [];

  return guardian.students.map(({ student }) => ({
    id: student.id,
    name: student.name,
    enrollmentNumber: student.enrollmentNumber,
    courseId: student.courseId,
    divisionId: student.divisionId,
    courseName: student.course.name,
    divisionName: student.division?.name ?? null,
  }));
}

export async function getActiveStudentId(students: PortalStudent[]): Promise<string | null> {
  if (students.length === 0) return null;
  const cookieStore = await cookies();
  const stored = cookieStore.get("activeStudentId")?.value;
  if (stored && students.some((s) => s.id === stored)) return stored;
  return students[0].id;
}
