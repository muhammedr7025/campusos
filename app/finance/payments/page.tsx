import { requireRole } from "@/lib/rbac/guard";
import { getCurrentTenant, getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";
import { PageHeader } from "@/components/layout/page-header";
import { FilterPills } from "@/components/layout/filter-pills";
import { PaymentsLedgerTable, type LedgerRow } from "@/components/finance/payments-ledger-table";
import { LogPaymentDialog, type PayableStudent } from "@/components/finance/log-payment-dialog";

const MODES = ["All", "CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"] as const;

export default async function PaymentsLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  const tenantId = await getTenantId();
  const tenant = await getCurrentTenant();
  const params = await searchParams;
  const mode = (MODES as readonly string[]).includes(params.mode ?? "") ? params.mode! : "All";

  const [payments, plans, planRows] = await Promise.all([
    prisma.payment.findMany({
      where: { tenantId, ...(mode === "All" ? {} : { mode: mode as never }) },
      include: {
        student: { select: { id: true, name: true, enrollmentNumber: true } },
        collectedBy: { select: { name: true } },
        corrections: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    getFeeSummaryForTenant(tenantId),
    prisma.feePlan.findMany({
      where: { tenantId },
      select: {
        id: true,
        studentId: true,
        installments: { select: { id: true, label: true, amount: true }, orderBy: { sequence: "asc" } },
      },
    }),
  ]);

  const rows: LedgerRow[] = payments.map((p) => ({
    id: p.id,
    // Rows predating receipt numbering fall back to a short id so the column
    // is never blank.
    receiptNumber: p.receiptNumber ?? p.id.slice(-8).toUpperCase(),
    studentId: p.student.id,
    studentName: p.student.name,
    enrollmentNumber: p.student.enrollmentNumber,
    amount: Number(p.amount),
    mode: p.mode,
    paidAt: p.paidAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    collectedBy: p.collectedBy.name,
    note: p.note,
    isCorrection: p.correctionOfId != null,
    isCorrected: p.corrections.length > 0,
  }));

  const planByStudent = new Map(planRows.map((p) => [p.studentId, p]));
  const payable: PayableStudent[] = plans
    .filter((p) => p.balance > 0)
    .map((p) => {
      const plan = planByStudent.get(p.studentId);
      return {
        id: p.studentId,
        name: p.studentName,
        enrollmentNumber: p.enrollmentNumber,
        feePlanId: p.feePlanId,
        balance: p.balance,
        installments: (plan?.installments ?? []).map((i) => ({
          id: i.id,
          label: i.label,
          amount: Number(i.amount),
        })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Finance"
        title="Payment ledger"
        description="Entries are immutable. A correction posts a reversal against the original receipt, so the trail stays intact."
        actions={payable.length > 0 ? <LogPaymentDialog students={payable} /> : undefined}
      />

      <FilterPills options={[...MODES]} active={mode} paramKey="mode" />

      <PaymentsLedgerTable rows={rows} tenantName={tenant?.name ?? "Institute"} />
    </div>
  );
}
