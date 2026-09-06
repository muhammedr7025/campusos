import { GraduationCap } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { capacityState } from "@/lib/academics/capacity";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { FilterPills } from "@/components/layout/filter-pills";

const FILTERS = ["All", "Open", "Full"] as const;

/**
 * Read-only for admissions: which divisions still have seats. Editing a
 * division stays with Admin — this exists so an officer can see where a
 * conversion will actually fit before starting one.
 */
export default async function DivisionCapacityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN, Role.ADMISSION_OFFICER);
  const tenantId = await getTenantId();
  const params = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(params.state ?? "") ? params.state! : "All";

  const divisions = await prisma.division.findMany({
    where: { tenantId },
    include: { course: { select: { name: true } }, _count: { select: { students: { where: ENROLLED_STUDENT_WHERE } } } },
    orderBy: [{ course: { name: "asc" } }, { name: "asc" }],
  });

  const rows = divisions
    .map((d) => ({
      id: d.id,
      name: d.name,
      courseName: d.course.name,
      filled: d._count.students,
      capacity: d.capacity,
      state: capacityState(d._count.students, d.capacity),
    }))
    .filter((r) => (filter === "All" ? true : filter === "Full" ? r.state === "full" : r.state !== "full"));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Admissions"
        title="Division capacity"
        description="Seats left per division. A division at capacity is blocked at admission, so check here before converting."
      />

      <FilterPills options={[...FILTERS]} active={filter} paramKey="state" />

      {rows.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No divisions in this view" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-muted-foreground text-sm">{r.courseName}</p>
                  </div>
                  {r.state === "full" ? (
                    <Badge variant="destructive">Full</Badge>
                  ) : r.state === "nearly-full" ? (
                    <Badge variant="warning">Filling up</Badge>
                  ) : (
                    <Badge variant="secondary">Open</Badge>
                  )}
                </div>
                <p className="tabular-nums">
                  {r.filled}
                  {r.capacity != null ? ` / ${r.capacity}` : ""}{" "}
                  <span className="text-muted-foreground text-sm">
                    {r.capacity != null ? `· ${Math.max(0, r.capacity - r.filled)} left` : "· no cap set"}
                  </span>
                </p>
                {r.capacity != null && (
                  <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                    <div
                      className={`h-full rounded-full ${r.state === "full" ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, Math.round((r.filled / Math.max(1, r.capacity)) * 100))}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
