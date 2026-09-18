import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePageSession } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { Role } from "@/generated/prisma/client";
import { canViewReceipt, getReceipt } from "@/lib/fees/receipt";
import { ReceiptDocument } from "@/components/finance/receipt-document";
import { PrintButton } from "@/components/finance/print-button";

/**
 * A receipt on its own page, outside every role's shell: what prints is the
 * receipt and nothing else, and the same link works for the finance desk and
 * for the family it was issued to. `?print=1` opens the print dialog on load.
 */
export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const session = await requirePageSession();
  const tenantId = await getTenantId();
  const { paymentId } = await params;
  const { print } = await searchParams;

  const receipt = await getReceipt(tenantId, paymentId);
  if (!receipt) notFound();
  if (!(await canViewReceipt(tenantId, session.user, receipt.student.id))) notFound();

  const isStaff = session.user.role === Role.SUPER_ADMIN || session.user.role === Role.FINANCE;
  const backHref = isStaff ? `/finance/payments/${receipt.student.id}` : "/portal/fees";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 print:p-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
          <ArrowLeft className="size-4" /> Back to {isStaff ? "fee plan" : "fees"}
        </Link>
        <PrintButton auto={print === "1"} />
      </div>
      <ReceiptDocument receipt={receipt} />
    </div>
  );
}
