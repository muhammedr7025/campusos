import Link from "next/link";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { FilterPills } from "@/components/layout/filter-pills";
import { PaymentsLedgerTable, type LedgerRow } from "@/components/finance/payments-ledger-table";
import { LogPaymentDialog, type PayableStudent } from "@/components/finance/log-payment-dialog";

const MODES = ["All", "CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"] as const;
const PAGE_SIZE = 200;

export default async function PaymentsLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  const tenantId = await getTenantId();
  const params = await searchParams;
  const mode = (MODES as readonly string[]).includes(params.mode ?? "") ? params.mode! : "All";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const where = { tenantId, ...(mode === "All" ? {} : { mode: mode as never }) };

  // The ledger used to stop at the latest 100 entries with no way to see
  // anything older; it pages instead.
  const [payments, totalCount, plans, planRows] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, enrollmentNumber: true } },
        collectedBy: { select: { name: true } },
        corrections: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.payment.count({ where }),
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
    .filter((p) => p.totalDue > 0)
    .map((p) => {
      const plan = planByStudent.get(p.studentId);
      return {
        id: p.studentId,
        name: p.studentName,
        enrollmentNumber: p.enrollmentNumber,
        feePlanId: p.feePlanId,
        balance: p.totalDue,
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

      <PaymentsLedgerTable rows={rows} />

      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            Entries {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={{ query: { ...(mode !== "All" ? { mode } : {}), page: page - 1 } }}>Newer</Link>
              </Button>
            )}
            {page * PAGE_SIZE < totalCount && (
              <Button asChild variant="outline" size="sm">
                <Link href={{ query: { ...(mode !== "All" ? { mode } : {}), page: page + 1 } }}>Older</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
