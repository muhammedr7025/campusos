import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { StudentsTable, type StudentRow } from "@/components/admissions/students-table";

export default async function StudentsPage() {
  await requireRole(Role.SUPER_ADMIN, Role.ADMISSION_OFFICER);
  const tenantId = await getTenantId();

  const students = await prisma.student.findMany({
    where: { tenantId },
    include: { course: { select: { name: true } }, division: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows: StudentRow[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    enrollmentNumber: s.enrollmentNumber,
    courseName: s.course.name,
    divisionName: s.division?.name ?? null,
    status: s.status,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
        <p className="text-muted-foreground text-sm">Every enrolled student at this institute.</p>
      </div>
      <StudentsTable students={rows} />
    </div>
  );
}
