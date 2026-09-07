import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { Role } from "@/generated/prisma/client";
import { percentByKey } from "@/lib/academics/attendance";
import { capacityState } from "@/lib/academics/capacity";
import { DivisionsTable, type DivisionRow } from "@/components/admin/divisions/divisions-table";
import { FilterPills } from "@/components/layout/filter-pills";

export default async function DivisionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();
  const params = await searchParams;

  const [divisions, courses, slots, attendance] = await Promise.all([
    prisma.division.findMany({
      where: { tenantId },
      include: { course: true, _count: { select: { students: { where: ENROLLED_STUDENT_WHERE } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    // A division has no class-teacher column of its own; who teaches it and
    // where is whatever the timetable says.
    prisma.timetable.findMany({
      where: { tenantId },
      select: { divisionId: true, room: true, teacher: { select: { name: true } } },
    }),
    prisma.attendance.groupBy({ by: ["divisionId", "status"], where: { tenantId }, _count: { _all: true } }),
  ]);

  const attendanceByDivision = percentByKey(attendance, "divisionId");

  const courseNames = courses.map((c) => c.name);
  const filterOptions = ["All", "Open", "Full", ...courseNames];
  const filter = filterOptions.includes(params.scope ?? "") ? params.scope! : "All";

  const allRows: DivisionRow[] = divisions.map((d) => {
    const divisionSlots = slots.filter((s) => s.divisionId === d.id);
    const faculty = [...new Set(divisionSlots.map((s) => s.teacher.name))];
    const rooms = [...new Set(divisionSlots.map((s) => s.room).filter((r): r is string => !!r))];
    return {
      id: d.id,
      name: d.name,
      courseName: d.course.name,
      capacity: d.capacity,
      studentCount: d._count.students,
      capacityState: capacityState(d._count.students, d.capacity),
      faculty,
      rooms,
      attendancePct: attendanceByDivision.get(d.id) ?? null,
    };
  });

  const rows = allRows.filter((r) => {
    if (filter === "All") return true;
    if (filter === "Full") return r.capacityState === "full";
    if (filter === "Open") return r.capacityState !== "full";
    return r.courseName === filter;
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="Academics" title="Divisions" description="Sections/class-groups within each course." />
      <FilterPills options={filterOptions} active={filter} paramKey="scope" />
      <DivisionsTable divisions={rows} courses={courses.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
