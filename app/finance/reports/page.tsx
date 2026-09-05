import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function CollectionReportPage() {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  const tenantId = await getTenantId();

  const [courses, plans] = await Promise.all([
    prisma.course.findMany({ where: { tenantId }, include: { batch: { select: { name: true } } }, orderBy: { name: "asc" } }),
    getFeeSummaryForTenant(tenantId),
  ]);

  const students = await prisma.student.findMany({ where: { tenantId }, select: { id: true, courseId: true } });
  const courseOf = new Map(students.map((s) => [s.id, s.courseId]));

  const rows = courses.map((course) => {
    const coursePlans = plans.filter((p) => courseOf.get(p.studentId) === course.id);
    const billed = coursePlans.reduce((sum, p) => sum + p.total, 0);
    const collected = coursePlans.reduce((sum, p) => sum + p.paid, 0);
    const outstanding = billed - collected;
    const pct = billed > 0 ? Math.round((collected / billed) * 100) : 0;
    return { course, studentCount: coursePlans.length, billed, collected, outstanding, pct };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Finance"
        title="Collection report"
        description="Target is 85% collected within the due date. Anything under 60% needs a reminder run, not a report."
      />

      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <Card key={r.course.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{r.course.name}</p>
                <p className="text-muted-foreground text-sm">{r.course.batch.name} · {r.studentCount} students</p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <div className="text-muted-foreground text-[11px] uppercase">Billed</div>
                  <div className="font-medium tabular-nums">₹{r.billed.toLocaleString("en-IN")}</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-[11px] uppercase">Collected</div>
                  <div className="font-medium text-[#15584A] tabular-nums">₹{r.collected.toLocaleString("en-IN")}</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-[11px] uppercase">Outstanding</div>
                  <div className={`font-medium tabular-nums ${r.outstanding > 0 ? "text-destructive" : ""}`}>
                    ₹{r.outstanding.toLocaleString("en-IN")}
                  </div>
                </div>
                <Badge variant={r.pct >= 85 ? "default" : r.pct >= 60 ? "warning" : "destructive"}>{r.pct}%</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
