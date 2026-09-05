import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { CoursesTable, type CourseRow } from "@/components/admin/courses/courses-table";

export default async function CoursesPage() {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();

  const [courses, batches] = await Promise.all([
    prisma.course.findMany({
      where: { tenantId },
      include: { batch: true, _count: { select: { divisions: true, students: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.batch.findMany({ where: { tenantId }, orderBy: { startYear: "desc" } }),
  ]);

  const rows: CourseRow[] = courses.map((c) => ({
    id: c.id,
    name: c.name,
    batchName: c.batch.name,
    durationLabel: c.durationLabel,
    divisionCount: c._count.divisions,
    studentCount: c._count.students,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="Academics" title="Courses" description="Programs offered under each batch." />
      <CoursesTable courses={rows} batches={batches.map((b) => ({ id: b.id, name: b.name }))} />
    </div>
  );
}
