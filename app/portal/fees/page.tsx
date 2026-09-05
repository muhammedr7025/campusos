import { Wallet, Users } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { Role } from "@/generated/prisma/client";
import { getPortalStudents, getActiveStudentId } from "@/lib/portal/context";
import { getCurrentFeePlanForStudent } from "@/lib/fees/balance";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ChildSwitcher } from "@/components/portal/child-switcher";

export default async function PortalFeesPage() {
  const session = await requireRole(Role.STUDENT, Role.PARENT);
  const tenantId = await getTenantId();

  const students = await getPortalStudents(tenantId, session.user.id, session.user.role);
  const activeStudentId = await getActiveStudentId(students);
  if (!activeStudentId) {
    return <EmptyState icon={Users} title="No student profile linked yet" />;
  }

  const detail = await getCurrentFeePlanForStudent(tenantId, activeStudentId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Account"
        title="Fees & receipts"
        description="Payment status and upcoming dues."
        actions={<ChildSwitcher students={students} activeStudentId={activeStudentId} />}
      />

      {!detail ? (
        <EmptyState icon={Wallet} title="No fee plan set up yet" />
      ) : (
        <>
          <Card>
            <CardContent className="grid grid-cols-3 gap-4 pt-6 text-center">
              <div>
                <p className="text-muted-foreground text-xs">Total</p>
                <p className="text-lg font-semibold">₹{detail.total.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Paid</p>
                <p className="text-lg font-semibold">₹{detail.paid.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Balance</p>
                <p className="text-lg font-semibold">₹{detail.balance.toLocaleString("en-IN")}</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            {detail.plan.installments.map((installment) => {
              const paidForInstallment = detail.plan.payments
                .filter((p) => p.installmentId === installment.id)
                .reduce((sum, p) => sum + Number(p.amount), 0);
              const settled = paidForInstallment >= Number(installment.amount);
              const overdue = !settled && installment.dueDate < new Date();
              return (
                <Card key={installment.id}>
                  <CardHeader className="flex flex-row items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{installment.label}</p>
                      <p className="text-muted-foreground text-xs">Due {installment.dueDate.toLocaleDateString()}</p>
                    </div>
                    <Badge variant={settled ? "default" : overdue ? "destructive" : "secondary"}>
                      {settled ? "Paid" : overdue ? "Overdue" : "Pending"}
                    </Badge>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
