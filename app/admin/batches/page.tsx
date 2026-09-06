import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { Role } from "@/generated/prisma/client";
import { BatchesTable, type BatchRow } from "@/components/admin/batches/batches-table";
import { FilterPills } from "@/components/layout/filter-pills";

const STATUSES = ["All", "ACTIVE", "UPCOMING", "ARCHIVED"] as const;

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();
  const params = await searchParams;
  const filter = (STATUSES as readonly string[]).includes(params.status ?? "") ? params.status! : "All";

  const [batches, students] = await Promise.all([
    prisma.batch.findMany({
      where: { tenantId, ...(filter === "All" ? {} : { status: filter as never }) },
      include: { _count: { select: { courses: true } }, courses: { select: { id: true } } },
      orderBy: { startYear: "desc" },
    }),
    // Students hang off a course, so a batch's headcount is the sum of its courses'.
    prisma.student.groupBy({ by: ["courseId"], where: { tenantId, ...ENROLLED_STUDENT_WHERE }, _count: { _all: true } }),
  ]);

  const studentsByCourse = new Map(students.map((s) => [s.courseId, s._count._all]));

  const rows: BatchRow[] = batches.map((b) => ({
    id: b.id,
    name: b.name,
    startYear: b.startYear,
    endYear: b.endYear,
    status: b.status,
    courseCount: b._count.courses,
    studentCount: b.courses.reduce((sum, c) => sum + (studentsByCourse.get(c.id) ?? 0), 0),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="Academics" title="Batches" description="Academic-year cohorts that group your courses." />
      <FilterPills options={[...STATUSES]} active={filter} paramKey="status" />
      <BatchesTable batches={rows} />
    </div>
  );
}
