import Link from "next/link";
import { GraduationCap, Wallet, Contact, ClipboardList, AlertTriangle, History } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "warning"> = {
  DELETE: "destructive",
  REJECT: "destructive",
  UPDATE: "warning",
  UPDATE_STATUS: "warning",
  CORRECT: "warning",
  REASSIGN_DIVISION: "warning",
};

export default async function AdminDashboardPage() {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const [
    studentCount,
    divisions,
    courses,
    leads,
    followUps,
    attendance,
    plans,
    recentLogs,
  ] = await Promise.all([
    prisma.student.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.division.findMany({ where: { tenantId }, select: { capacity: true } }),
    prisma.course.findMany({ where: { tenantId }, include: { batch: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.lead.findMany({ where: { tenantId }, select: { status: true } }),
    prisma.followUp.findMany({ where: { tenantId, scheduledAt: { lt: now }, completedAt: null }, select: { id: true } }),
    prisma.attendance.findMany({ where: { tenantId, date: { gte: thirtyDaysAgo } }, select: { status: true } }),
    getFeeSummaryForTenant(tenantId),
    prisma.auditLog.findMany({
      where: { tenantId },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const students = await prisma.student.findMany({ where: { tenantId }, select: { id: true, courseId: true } });
  const courseOfStudent = new Map(students.map((s) => [s.id, s.courseId]));

  const divisionCount = divisions.length;
  const totalCapacity = divisions.reduce((sum, d) => sum + (d.capacity ?? 0), 0);
  const capacityPct = totalCapacity > 0 ? Math.round((studentCount / totalCapacity) * 100) : null;

  const billed = plans.reduce((sum, p) => sum + p.total, 0);
  const collected = plans.reduce((sum, p) => sum + p.paid, 0);
  const outstanding = plans.reduce((sum, p) => sum + p.balance, 0);
  const billedPct = billed > 0 ? Math.round((collected / billed) * 100) : 0;

  const openLeads = leads.filter((l) => l.status !== "CONVERTED" && l.status !== "LOST").length;
  const readyLeads = leads.filter((l) => l.status === "READY").length;
  const overdueFollowUps = followUps.length;

  const attPresent = attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  const attPct = attendance.length > 0 ? Math.round((attPresent / attendance.length) * 100) : null;

  const needsAttention = overdueFollowUps > 0 || readyLeads > 0 || outstanding > 0;

  const courseRows = courses
    .map((course) => {
      const coursePlans = plans.filter((p) => courseOfStudent.get(p.studentId) === course.id);
      const courseBilled = coursePlans.reduce((sum, p) => sum + p.total, 0);
      const courseCollected = coursePlans.reduce((sum, p) => sum + p.paid, 0);
      const pct = courseBilled > 0 ? Math.round((courseCollected / courseBilled) * 100) : 0;
      return { course, billed: courseBilled, collected: courseCollected, pct };
    })
    .filter((r) => r.billed > 0)
    .sort((a, b) => b.billed - a.billed)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="Institute" title="Institute overview" description="Full visibility: money, CRM, academics, audit." />

      {needsAttention && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
            <AlertTriangle className="text-warning-foreground size-4 shrink-0" />
            <span className="eyebrow text-warning-foreground">Needs attention</span>
            <span className="text-muted-foreground">
              {overdueFollowUps} follow-up{overdueFollowUps === 1 ? "" : "s"} overdue · {readyLeads} lead{readyLeads === 1 ? "" : "s"} ready to convert · ₹
              {outstanding.toLocaleString("en-IN")} fees outstanding
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Enrolled students"
          value={studentCount}
          sub={capacityPct != null ? `${capacityPct}% of capacity across ${divisionCount} divisions` : `across ${divisionCount} division${divisionCount === 1 ? "" : "s"}`}
          icon={GraduationCap}
          progress={capacityPct ?? undefined}
        />
        <StatCard
          label="Fees collected"
          value={`₹${collected.toLocaleString("en-IN")}`}
          sub={`${billedPct}% of billed`}
          icon={Wallet}
          progress={billedPct}
        />
        <StatCard
          label="Open leads"
          value={openLeads}
          sub={`${overdueFollowUps} overdue follow-up${overdueFollowUps === 1 ? "" : "s"}`}
          icon={Contact}
          progress={openLeads > 0 ? Math.round((overdueFollowUps / openLeads) * 100) : 0}
        />
        <StatCard
          label="Avg attendance"
          value={attPct != null ? `${attPct}%` : "—"}
          sub="institute-wide, last 30 days"
          icon={ClipboardList}
          progress={attPct ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Collected vs billed</CardTitle>
              <CardDescription>Live from payment entries</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/finance/payments">Open ledger</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {courseRows.length === 0 ? (
              <p className="text-muted-foreground text-sm">No fee plans yet.</p>
            ) : (
              courseRows.map((r) => (
                <div key={r.course.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{r.course.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      ₹{r.collected.toLocaleString("en-IN")} / ₹{r.billed.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, r.pct)}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest activity</CardTitle>
            <CardDescription>Every write lands in the audit log</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {recentLogs.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing logged yet.</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={ACTION_VARIANT[log.action] ?? "default"} className="shrink-0">
                        {log.action}
                      </Badge>
                      <span className="truncate font-medium">
                        {log.entityType} · {log.actor?.name ?? "System"}
                      </span>
                    </div>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {log.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </span>
                </div>
              ))
            )}
            <Button asChild size="sm" variant="ghost" className="mt-1 w-fit">
              <Link href="/admin/audit">
                <History className="size-3.5" /> View full audit log
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
