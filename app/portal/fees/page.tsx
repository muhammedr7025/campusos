import Link from "next/link";
import { Wallet, Users, Receipt } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { Role } from "@/generated/prisma/client";
import { getPortalStudents, getActiveStudentId } from "@/lib/portal/context";
import { getCurrentFeePlanForStudent } from "@/lib/fees/balance";
import { receiptLabel } from "@/lib/fees/receipt";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        description="Payment status, upcoming dues, and a printable receipt for every payment."
        actions={<ChildSwitcher students={students} activeStudentId={activeStudentId} />}
      />

      {!detail ? (
        <EmptyState icon={Wallet} title="No fee plan set up yet" />
      ) : (
        <>
          <Card>
            <CardContent className={`grid gap-4 pt-6 text-center ${detail.lateFee > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
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
              {detail.lateFee > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs">Late fee</p>
                  <p className="text-destructive text-lg font-semibold">₹{detail.lateFee.toLocaleString("en-IN")}</p>
                </div>
              )}
            </CardContent>
            {detail.lateFee > 0 && (
              <CardContent className="pt-0 text-center">
                <p className="text-muted-foreground text-xs">
                  ₹{detail.totalDue.toLocaleString("en-IN")} clears everything today, late fee included.
                </p>
              </CardContent>
            )}
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
                      <p className="text-muted-foreground text-xs">
                        ₹{Number(installment.amount).toLocaleString("en-IN")} · Due {installment.dueDate.toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={settled ? "default" : overdue ? "destructive" : "secondary"}>
                      {settled ? "Paid" : overdue ? "Overdue" : "Pending"}
                    </Badge>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Receipts</h2>
            {detail.plan.payments.length === 0 ? (
              <EmptyState icon={Receipt} title="No payments yet" description="Every payment logged by the institute gets a receipt here." />
            ) : (
              <div className="flex flex-col gap-2">
                {detail.plan.payments.map((payment) => (
                  <Card key={payment.id}>
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {Number(payment.amount) < 0 ? "− " : ""}₹{Math.abs(Number(payment.amount)).toLocaleString("en-IN")}
                          <span className="text-muted-foreground ml-2 font-mono text-xs">{receiptLabel(payment)}</span>
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {payment.mode.replace("_", " ")} · {payment.paidAt.toLocaleDateString()}
                          {payment.correctionOfId ? " · correction" : ""}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/receipts/${payment.id}`} target="_blank" rel="noreferrer">
                          <Receipt /> View / print
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
