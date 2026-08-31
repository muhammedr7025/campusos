import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId, getCurrentTenant } from "@/lib/tenant";
import { Role } from "@/generated/prisma/client";
import { getCurrentFeePlanForStudent } from "@/lib/fees/balance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LogPaymentDialog } from "@/components/finance/log-payment-dialog";
import { CorrectPaymentDialog } from "@/components/finance/correct-payment-dialog";
import { ReceiptDialog } from "@/components/finance/receipt-dialog";
import { FeePlanOverrideDialog } from "@/components/finance/fee-plan-override-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { Receipt } from "lucide-react";

export default async function StudentFeePlanPage({ params }: { params: Promise<{ studentId: string }> }) {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  const tenantId = await getTenantId();
  const tenant = await getCurrentTenant();
  const { studentId } = await params;

  const detail = await getCurrentFeePlanForStudent(tenantId, studentId);
  if (!detail) notFound();
  const { plan, total, paid, balance } = detail;

  const installmentPaid = new Map<string, number>();
  for (const payment of plan.payments) {
    if (!payment.installmentId) continue;
    installmentPaid.set(payment.installmentId, (installmentPaid.get(payment.installmentId) ?? 0) + Number(payment.amount));
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/finance/dues" className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Back to dues
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl">{plan.student.name}</CardTitle>
            <p className="text-muted-foreground text-sm">{plan.student.enrollmentNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={balance === 0 ? "default" : "secondary"}>{balance === 0 ? "Paid" : "Balance due"}</Badge>
            <FeePlanOverrideDialog studentId={studentId} />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-muted-foreground text-xs">Total</p>
            <p className="text-lg font-semibold">₹{total.toLocaleString("en-IN")}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Paid</p>
            <p className="text-lg font-semibold">₹{paid.toLocaleString("en-IN")}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Balance</p>
            <p className="text-lg font-semibold">₹{balance.toLocaleString("en-IN")}</p>
          </div>
        </CardContent>
        {plan.overrideReason && (
          <CardContent className="pt-0">
            <p className="text-muted-foreground text-xs">
              Custom plan — {plan.overrideReason} (approved by {plan.approvedBy?.name})
            </p>
          </CardContent>
        )}
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Installments</h2>
          <LogPaymentDialog
            studentId={studentId}
            feePlanId={plan.id}
            installments={plan.installments.map((i) => ({ id: i.id, label: i.label, amount: Number(i.amount) }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          {plan.installments.map((installment) => {
            const paidForInstallment = installmentPaid.get(installment.id) ?? 0;
            const settled = paidForInstallment >= Number(installment.amount);
            return (
              <Card key={installment.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{installment.label}</p>
                    <p className="text-muted-foreground text-xs">Due {installment.dueDate.toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">₹{paidForInstallment.toLocaleString("en-IN")} / ₹{Number(installment.amount).toLocaleString("en-IN")}</span>
                    <Badge variant={settled ? "default" : "secondary"}>{settled ? "Settled" : "Due"}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Payment history</h2>
        {plan.payments.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments logged yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {plan.payments.map((payment) => (
              <Card key={payment.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">
                      {Number(payment.amount) < 0 ? "− " : ""}₹{Math.abs(Number(payment.amount)).toLocaleString("en-IN")}
                      {payment.correctionOfId && <span className="text-muted-foreground text-xs"> (correction)</span>}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {payment.mode.replace("_", " ")} · {payment.paidAt.toLocaleDateString()} · by {payment.collectedBy.name}
                    </p>
                    {payment.note && <p className="text-muted-foreground text-xs">{payment.note}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {!payment.correctionOfId && (
                      <>
                        <ReceiptDialog
                          tenantName={tenant?.name ?? ""}
                          studentName={plan.student.name}
                          enrollmentNumber={plan.student.enrollmentNumber}
                          amount={Number(payment.amount)}
                          mode={payment.mode}
                          paidAt={payment.paidAt.toLocaleDateString()}
                          collectedBy={payment.collectedBy.name}
                          receiptNo={payment.id.slice(-8).toUpperCase()}
                        />
                        <CorrectPaymentDialog paymentId={payment.id} currentAmount={Number(payment.amount)} />
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Separator />
    </div>
  );
}
