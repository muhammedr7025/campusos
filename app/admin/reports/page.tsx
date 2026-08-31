import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnrollmentTrendChart } from "@/components/admin/reports/enrollment-trend-chart";
import { CollectionChart } from "@/components/admin/reports/collection-chart";
import { AttendanceTrendChart } from "@/components/admin/reports/attendance-trend-chart";

export default async function ReportsPage() {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);

  const [students, leads, plans, attendance] = await Promise.all([
    prisma.student.findMany({ where: { tenantId }, select: { createdAt: true } }),
    prisma.lead.findMany({ where: { tenantId }, select: { status: true } }),
    getFeeSummaryForTenant(tenantId),
    prisma.attendance.findMany({
      where: { tenantId, date: { gte: fourteenDaysAgo } },
      select: { date: true, status: true },
    }),
  ]);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-US", { month: "short" }) };
  });
  const enrollmentData = months.map(({ key, label }) => ({
    month: label,
    students: students.filter((s) => `${s.createdAt.getFullYear()}-${s.createdAt.getMonth()}` === key).length,
  }));

  const collected = plans.reduce((sum, p) => sum + p.paid, 0);
  const pending = plans.reduce((sum, p) => sum + p.balance, 0);

  const totalLeads = leads.length;
  const converted = leads.filter((l) => l.status === "CONVERTED").length;
  const conversionRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;

  const byDate = new Map<string, { present: number; total: number }>();
  for (const a of attendance) {
    const key = a.date.toISOString().slice(0, 10);
    const entry = byDate.get(key) ?? { present: 0, total: 0 };
    entry.total += 1;
    if (a.status === "PRESENT" || a.status === "LATE") entry.present += 1;
    byDate.set(key, entry);
  }
  const attendanceData = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { present, total }]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm">Institute-wide trends.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-muted-foreground text-sm font-medium">Total students</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{students.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-muted-foreground text-sm font-medium">Lead → admission rate</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{conversionRate}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-muted-foreground text-sm font-medium">Total leads</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalLeads}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EnrollmentTrendChart data={enrollmentData} />
        <CollectionChart collected={collected} pending={pending} />
      </div>

      {attendanceData.length > 0 && <AttendanceTrendChart data={attendanceData} />}
    </div>
  );
}
