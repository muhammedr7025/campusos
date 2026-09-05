import Link from "next/link";
import { Megaphone } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { Role } from "@/generated/prisma/client";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { SendReminderButton } from "@/components/finance/send-reminder-button";

export default async function RemindersPage() {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  const tenantId = await getTenantId();

  const plans = await getFeeSummaryForTenant(tenantId);
  const dueStudents = plans.filter((p) => p.balance > 0).sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Finance"
        title="Reminder queue"
        description="Automated reminders fire at configured intervals; this queue is for manual nudges on top."
      />

      {dueStudents.length === 0 ? (
        <EmptyState icon={Megaphone} title="Nothing outstanding" description="Every student is fully paid." />
      ) : (
        <div className="flex flex-col gap-2">
          {dueStudents.map((p) => (
            <Card key={p.feePlanId}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link href={`/finance/payments/${p.studentId}`} className="font-medium hover:underline">
                    {p.studentName}
                  </Link>
                  <p className="text-muted-foreground text-sm">
                    {p.enrollmentNumber} · ₹{p.balance.toLocaleString("en-IN")} outstanding
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.isOverdue ? "destructive" : "warning"}>{p.isOverdue ? "Overdue" : "Pending"}</Badge>
                  <SendReminderButton studentId={p.studentId} studentName={p.studentName} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
