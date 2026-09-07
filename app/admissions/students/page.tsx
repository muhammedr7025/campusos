import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { Role } from "@/generated/prisma/client";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";
import { percentByKey } from "@/lib/academics/attendance";
import { StudentsTable, type StudentRow } from "@/components/admissions/students-table";
import { AdmitStudentDialog } from "@/components/admissions/admit-student-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { FilterPills } from "@/components/layout/filter-pills";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireRole(Role.SUPER_ADMIN, Role.ADMISSION_OFFICER);
  const tenantId = await getTenantId();
  const params = await searchParams;

  const [students, attendance, plans, courses] = await Promise.all([
    prisma.student.findMany({
      where: { tenantId },
      include: {
        course: { select: { name: true } },
        division: { select: { id: true, name: true } },
        guardians: {
          where: { isPrimary: true },
          take: 1,
          include: { guardian: { select: { name: true, phone: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.attendance.groupBy({ by: ["studentId", "status"], where: { tenantId }, _count: { _all: true } }),
    getFeeSummaryForTenant(tenantId),
    prisma.course.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        divisions: { select: { id: true, name: true, capacity: true, _count: { select: { students: { where: ENROLLED_STUDENT_WHERE } } } }, orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const balanceByStudent = new Map<string, number>();
  for (const p of plans) balanceByStudent.set(p.studentId, (balanceByStudent.get(p.studentId) ?? 0) + p.balance);

  const attendanceByStudent = percentByKey(attendance, "studentId");

  const allRows: StudentRow[] = students.map((s) => {
    return {
      id: s.id,
      name: s.name,
      enrollmentNumber: s.enrollmentNumber,
      courseName: s.course.name,
      divisionName: s.division?.name ?? null,
      guardianName: s.guardians[0]?.guardian.name ?? null,
      guardianPhone: s.guardians[0]?.guardian.phone ?? null,
      attendancePct: attendanceByStudent.get(s.id) ?? null,
      balance: balanceByStudent.get(s.id) ?? 0,
      status: s.status,
    };
  });

  const divisionNames = [...new Set(students.map((s) => s.division?.name).filter((n): n is string => !!n))].sort();
  const filter = params.division && divisionNames.includes(params.division) ? params.division : "All";
  const rows = filter === "All" ? allRows : allRows.filter((r) => r.divisionName === filter);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Admissions"
        title="Admitted students"
        description="Every enrolled student at this institute."
        actions={
          <AdmitStudentDialog
            courses={courses.map((c) => ({
              id: c.id,
              name: c.name,
              divisions: c.divisions.map((d) => ({
                id: d.id,
                name: d.name,
                capacity: d.capacity,
                studentCount: d._count.students,
              })),
            }))}
          />
        }
      />

      {divisionNames.length > 0 && (
        <FilterPills options={["All", ...divisionNames]} active={filter} paramKey="division" />
      )}

      <StudentsTable students={rows} canDelete={session.user.role === Role.SUPER_ADMIN} />
    </div>
  );
}
