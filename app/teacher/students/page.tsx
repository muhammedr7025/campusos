import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { attendancePercent } from "@/lib/academics/attendance";
import { MyStudentsTable, type MyStudentRow } from "@/components/teacher/my-students-table";

export default async function MyStudentsPage() {
  const session = await requireRole(Role.SUPER_ADMIN, Role.TEACHER);
  const tenantId = await getTenantId();

  const myTimetable = await prisma.timetable.findMany({
    where: { tenantId, teacherId: session.user.id },
    select: { divisionId: true },
  });
  const isAdmin = session.user.role === Role.SUPER_ADMIN;
  const myDivisionIds = isAdmin ? undefined : [...new Set(myTimetable.map((t) => t.divisionId))];

  const students = await prisma.student.findMany({
    where: { tenantId, status: "ACTIVE", ...(myDivisionIds ? { divisionId: { in: myDivisionIds } } : {}) },
    select: {
      id: true,
      name: true,
      enrollmentNumber: true,
      divisionId: true,
      division: { select: { name: true, course: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const studentIds = students.map((s) => s.id);
  const divisionIds = [...new Set(students.map((s) => s.divisionId).filter((id): id is string => !!id))];

  const [attendance, assignments, submissions, marks] = await Promise.all([
    prisma.attendance.findMany({ where: { tenantId, studentId: { in: studentIds } }, select: { studentId: true, status: true } }),
    prisma.assignment.findMany({ where: { tenantId, divisionId: { in: divisionIds } }, select: { id: true, divisionId: true } }),
    prisma.submission.findMany({
      where: { tenantId, studentId: { in: studentIds }, status: { not: "MISSING" } },
      select: { studentId: true, assignmentId: true },
    }),
    prisma.mark.findMany({
      where: { tenantId, studentId: { in: studentIds } },
      select: { studentId: true, score: true, exam: { select: { maxMarks: true } } },
    }),
  ]);

  const postedByDivision = new Map<string, number>();
  for (const a of assignments) postedByDivision.set(a.divisionId, (postedByDivision.get(a.divisionId) ?? 0) + 1);
  const postedAssignmentIds = new Set(assignments.map((a) => a.id));

  const rows: MyStudentRow[] = students.map((s) => {
    const attPct = attendancePercent(attendance.filter((a) => a.studentId === s.id));

    const posted = s.divisionId ? (postedByDivision.get(s.divisionId) ?? 0) : 0;
    const submitted = submissions.filter((sub) => sub.studentId === s.id && postedAssignmentIds.has(sub.assignmentId)).length;

    const myMarks = marks.filter((m) => m.studentId === s.id);
    const avgMarks = myMarks.length > 0
      ? Math.round(myMarks.reduce((sum, m) => sum + (Number(m.score) / m.exam.maxMarks) * 100, 0) / myMarks.length)
      : null;

    const risk = (attPct != null && attPct < 75) || (posted > 0 && submitted < posted / 2) || (avgMarks != null && avgMarks < 50);

    return {
      id: s.id,
      name: s.name,
      enrollmentNumber: s.enrollmentNumber,
      divisionName: s.division?.name ?? "—",
      courseName: s.division?.course.name ?? "—",
      attendancePct: attPct,
      submitted,
      posted,
      avgMarks,
      risk,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Class"
        title="My students"
        description="Standing combines attendance, submission rate and test average."
      />
      <MyStudentsTable rows={rows} />
    </div>
  );
}
