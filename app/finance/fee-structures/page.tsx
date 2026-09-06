import { Wallet } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { FeeStructureFormDialog } from "@/components/finance/fee-structure-form-dialog";
import { DeleteFeeStructureButton } from "@/components/finance/delete-fee-structure-button";
import { PageHeader } from "@/components/layout/page-header";
import { FilterPills } from "@/components/layout/filter-pills";

export default async function FeeStructuresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  const tenantId = await getTenantId();
  const params = await searchParams;

  const allCourses = await prisma.course.findMany({ where: { tenantId }, select: { name: true }, orderBy: { name: "asc" } });
  const courseNames = allCourses.map((c) => c.name);
  const filter = params.course && courseNames.includes(params.course) ? params.course : "All";

  const [structures, courses, students] = await Promise.all([
    prisma.feeStructure.findMany({
      where: { tenantId, ...(filter === "All" ? {} : { course: { name: filter } }) },
      include: { course: true, installments: { orderBy: { sequence: "asc" } }, _count: { select: { feePlans: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.student.findMany({ where: { tenantId }, select: { courseId: true } }),
  ]);

  const studentCountByCourse = new Map<string, number>();
  for (const s of students) studentCountByCourse.set(s.courseId, (studentCountByCourse.get(s.courseId) ?? 0) + 1);

  const lateFeeLabel = (type: string | null, value: number | null) => {
    if (!type || !value) return null;
    return type === "PERCENT" ? `${value}% late fee` : `₹${value.toLocaleString("en-IN")} late fee`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Finance"
        title="Fee structures"
        description="Per-course billing plans, applied automatically at admission."
        actions={<FeeStructureFormDialog courses={courses.map((c) => ({ id: c.id, name: c.name }))} />}
      />

      {courseNames.length > 1 && <FilterPills options={["All", ...courseNames]} active={filter} paramKey="course" />}

      {structures.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No fee structures yet"
          description="Create one per course so every admitted student is billed consistently."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {structures.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="text-base">{s.name}</CardTitle>
                <p className="text-muted-foreground text-sm">{s.course.name}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-lg font-semibold">₹{Number(s.totalAmount).toLocaleString("en-IN")}</p>
                <div className="flex flex-wrap gap-1">
                  {s.installments.map((i) => (
                    <Badge key={i.id} variant="secondary">
                      {i.label}: ₹{Number(i.amount).toLocaleString("en-IN")}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">
                    {s._count.feePlans} of {studentCountByCourse.get(s.courseId) ?? 0} in course
                  </span>
                  {lateFeeLabel(s.lateFeeType, s.lateFeeValue ? Number(s.lateFeeValue) : null) && (
                    <span className="text-muted-foreground">
                      {lateFeeLabel(s.lateFeeType, Number(s.lateFeeValue))} · {s.gracePeriodDays}-day grace
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <FeeStructureFormDialog
                    courses={courses.map((c) => ({ id: c.id, name: c.name }))}
                    structure={{
                      id: s.id,
                      courseId: s.courseId,
                      name: s.name,
                      gracePeriodDays: s.gracePeriodDays,
                      lateFeeType: s.lateFeeType,
                      lateFeeValue: s.lateFeeValue ? Number(s.lateFeeValue) : 0,
                      installments: s.installments.map((i) => ({
                        label: i.label,
                        amount: Number(i.amount),
                        dueDate: i.dueDate.toISOString().slice(0, 10),
                      })),
                    }}
                  />
                  {s._count.feePlans === 0 && <DeleteFeeStructureButton id={s.id} name={s.name} />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
