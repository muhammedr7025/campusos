import Link from "next/link";
import { Wallet, AlertCircle, AlertTriangle, Receipt, History } from "lucide-react";
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

export default async function FinanceDashboardPage() {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  const tenantId = await getTenantId();

  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 86400000);

  const [plans, paymentCount, courses, students, recentLogs] = await Promise.all([
    getFeeSummaryForTenant(tenantId),
    prisma.payment.count({ where: { tenantId, amount: { gt: 0 } } }),
    prisma.course.findMany({ where: { tenantId }, include: { batch: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.student.findMany({ where: { tenantId }, select: { id: true, courseId: true } }),
    prisma.auditLog.findMany({
      where: { tenantId, entityType: { in: ["Payment", "FeePlan", "DiscountRequest", "Reminder", "ReminderBatch"] } },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const billed = plans.reduce((sum, p) => sum + p.total, 0);
  const collected = plans.reduce((sum, p) => sum + p.paid, 0);
  const outstanding = plans.reduce((sum, p) => sum + p.balance, 0);
  const billedPct = billed > 0 ? Math.round((collected / billed) * 100) : 0;

  const overduePlans = plans.filter((p) => p.isOverdue);
  const overdueAmt = overduePlans.reduce((sum, p) => sum + p.balance, 0);
  const approachingPlans = plans.filter((p) => !p.isOverdue && p.balance > 0 && p.nextDueDate && p.nextDueDate <= sevenDaysOut);
  const studentsWithBalance = plans.filter((p) => p.balance > 0).length;

  const courseOfStudent = new Map(students.map((s) => [s.id, s.courseId]));
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
      <PageHeader crumb="Finance" title="Collections overview" description="Structures, payments, dues, reminders, approvals." />

      {(overduePlans.length > 0 || approachingPlans.length > 0) && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
            <AlertTriangle className="text-warning-foreground size-4 shrink-0" />
            <span className="eyebrow text-warning-foreground">Needs attention</span>
            <span className="text-muted-foreground">
              {overduePlans.length} student{overduePlans.length === 1 ? "" : "s"} past due (₹{overdueAmt.toLocaleString("en-IN")}) ·{" "}
              {approachingPlans.length} installment{approachingPlans.length === 1 ? "" : "s"} approaching
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Collected"
          value={`₹${collected.toLocaleString("en-IN")}`}
          sub={`of ₹${billed.toLocaleString("en-IN")} billed`}
          icon={Wallet}
          progress={billedPct}
        />
        <StatCard
          label="Outstanding"
          value={`₹${outstanding.toLocaleString("en-IN")}`}
          sub={`${studentsWithBalance} student${studentsWithBalance === 1 ? "" : "s"}`}
          icon={AlertCircle}
          progress={billed > 0 ? Math.round((outstanding / billed) * 100) : 0}
        />
        <StatCard
          label="Overdue"
          value={`₹${overdueAmt.toLocaleString("en-IN")}`}
          sub={`${overduePlans.length} past due`}
          icon={AlertTriangle}
          progress={billed > 0 ? Math.round((overdueAmt / billed) * 100) : 0}
        />
        <StatCard label="Entries logged" value={paymentCount} sub="immutable, audited" icon={Receipt} />
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
