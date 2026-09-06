import Link from "next/link";
import { Megaphone } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { SendReminderButton } from "@/components/finance/send-reminder-button";
import { SendBulkRemindersButton } from "@/components/finance/send-bulk-reminders-button";
import { LogPaymentDialog } from "@/components/finance/log-payment-dialog";
import { FilterPills } from "@/components/layout/filter-pills";

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  const tenantId = await getTenantId();
  const params = await searchParams;
  const filter = params.status === "Overdue" || params.status === "Pending" ? params.status : "All";

  const plans = await getFeeSummaryForTenant(tenantId);
  const allDue = plans.filter((p) => p.balance > 0).sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue));
  const dueStudents = allDue.filter((p) => filter === "All" || (filter === "Overdue" ? p.isOverdue : !p.isOverdue));

  // Course/division and the plan's installments, so a reminder can turn
  // straight into a logged payment without leaving the queue.
  const students = await prisma.student.findMany({
    where: { tenantId, id: { in: allDue.map((p) => p.studentId) } },
    select: {
      id: true,
      course: { select: { name: true } },
      division: { select: { name: true } },
      feePlans: {
        select: { id: true, installments: { select: { id: true, label: true, amount: true }, orderBy: { sequence: "asc" } } },
      },
    },
  });
  const contextByStudent = new Map(students.map((s) => [s.id, s]));

  const lastReminders = await prisma.auditLog.findMany({
    where: { tenantId, entityType: "Reminder", entityId: { in: allDue.map((p) => p.studentId) } },
    orderBy: { createdAt: "desc" },
    select: { entityId: true, createdAt: true },
  });
  const lastReminderByStudent = new Map<string, Date>();
  for (const log of lastReminders) {
    if (!lastReminderByStudent.has(log.entityId)) lastReminderByStudent.set(log.entityId, log.createdAt);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Finance"
        title="Reminder queue"
        description="Automated reminders fire at configured intervals; this queue is for manual nudges on top."
        actions={<SendBulkRemindersButton />}
      />

      <FilterPills options={["All", "Overdue", "Pending"]} active={filter} paramKey="status" />

      {dueStudents.length === 0 ? (
        <EmptyState icon={Megaphone} title="Nothing outstanding" description="Every student in this filter is fully paid." />
      ) : (
        <div className="flex flex-col gap-2">
          {dueStudents.map((p) => {
            const lastReminder = lastReminderByStudent.get(p.studentId);
            const context = contextByStudent.get(p.studentId);
            const plan = context?.feePlans.find((fp) => fp.id === p.feePlanId) ?? context?.feePlans[0];
            return (
              <Card key={p.feePlanId}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link href={`/finance/payments/${p.studentId}`} className="font-medium hover:underline">
                      {p.studentName}
                    </Link>
                    <p className="text-muted-foreground text-sm">
                      {context?.course.name ?? "—"}
                      {context?.division?.name ? ` · ${context.division.name}` : ""} · {p.enrollmentNumber}
                    </p>
                    <p className="text-sm">
                      <span className="text-destructive font-semibold tabular-nums">
                        ₹{p.balance.toLocaleString("en-IN")}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        outstanding
                        {p.nextDueDate
                          ? ` · due ${p.nextDueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                          : " · past due"}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {lastReminder
                        ? `Last reminder ${lastReminder.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
                        : "No reminder sent yet"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={p.isOverdue ? "destructive" : "warning"}>{p.isOverdue ? "Overdue" : "Pending"}</Badge>
                    <SendReminderButton studentId={p.studentId} studentName={p.studentName} />
                    {plan && (
                      <LogPaymentDialog
                        students={[
                          {
                            id: p.studentId,
                            name: p.studentName,
                            enrollmentNumber: p.enrollmentNumber,
                            feePlanId: plan.id,
                            balance: p.balance,
                            installments: plan.installments.map((i) => ({
                              id: i.id,
                              label: i.label,
                              amount: Number(i.amount),
                            })),
                          },
                        ]}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
