import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { Role } from "@/generated/prisma/client";
import { CoursesTable, type CourseRow } from "@/components/admin/courses/courses-table";
import { FilterPills } from "@/components/layout/filter-pills";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();
  const params = await searchParams;

  const [courses, batches] = await Promise.all([
    prisma.course.findMany({
      where: { tenantId },
      include: {
        batch: true,
        _count: { select: { divisions: true, students: { where: ENROLLED_STUDENT_WHERE } } },
        // The plan a new admission is billed on — same lookup admitStudent uses.
        feeStructures: { select: { totalAmount: true }, orderBy: { createdAt: "asc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.batch.findMany({ where: { tenantId }, orderBy: { startYear: "desc" } }),
  ]);

  const batchNames = batches.map((b) => b.name);
  const filter = params.batch && batchNames.includes(params.batch) ? params.batch : "All";

  const rows: CourseRow[] = courses
    .filter((c) => filter === "All" || c.batch.name === filter)
    .map((c) => ({
      id: c.id,
      name: c.name,
      batchName: c.batch.name,
      durationLabel: c.durationLabel,
      divisionCount: c._count.divisions,
      studentCount: c._count.students,
      defaultFee: c.feeStructures[0] ? Number(c.feeStructures[0].totalAmount) : null,
    }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="Academics" title="Courses" description="Programs offered under each batch." />
      {batchNames.length > 0 && <FilterPills options={["All", ...batchNames]} active={filter} paramKey="batch" />}
      <CoursesTable courses={rows} batches={batches.map((b) => ({ id: b.id, name: b.name }))} />
    </div>
  );
}
