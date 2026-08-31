import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { DivisionsTable, type DivisionRow } from "@/components/admin/divisions/divisions-table";

export default async function DivisionsPage() {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();

  const [divisions, courses] = await Promise.all([
    prisma.division.findMany({
      where: { tenantId },
      include: { course: true, _count: { select: { students: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
  ]);

  const rows: DivisionRow[] = divisions.map((d) => ({
    id: d.id,
    name: d.name,
    courseName: d.course.name,
    capacity: d.capacity,
    studentCount: d._count.students,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Divisions</h1>
        <p className="text-muted-foreground text-sm">Sections/class-groups within each course.</p>
      </div>
      <DivisionsTable divisions={rows} courses={courses.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
