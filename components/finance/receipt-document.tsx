import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { amountInWords, type ReceiptData } from "@/lib/fees/receipt";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-dashed border-neutral-300 py-2 text-sm last:border-0">
      <span className="text-neutral-600">{label}</span>
      <span className={`text-right ${strong ? "text-base font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

/**
 * The receipt as it prints: black on white, no theme tokens, no shell — the
 * same document on screen, on paper and as a saved PDF. Everything here is
 * ledger fact; the balance line is as of this receipt, so a receipt already
 * handed over never changes when later payments land.
 */
export function ReceiptDocument({ receipt }: { receipt: ReceiptData }) {
  return (
    <article className="receipt-printable mx-auto w-full max-w-[640px] rounded-lg border border-neutral-300 bg-white p-8 text-neutral-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4 border-b-2 border-neutral-900 pb-4">
        <div className="flex items-center gap-3">
          {receipt.institute.logoUrl ? (
            <Image src={receipt.institute.logoUrl} alt="" width={48} height={48} className="size-12 rounded object-contain" unoptimized />
          ) : (
            <div className="flex size-12 items-center justify-center rounded bg-neutral-900 text-lg font-semibold text-white">
              {receipt.institute.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold leading-tight">{receipt.institute.name}</h1>
            <p className="text-xs uppercase tracking-[.14em] text-neutral-500">Fee receipt</p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono text-base font-semibold">{receipt.receiptNumber}</p>
          <p className="text-neutral-600">{date(receipt.paidAt)}</p>
          {receipt.isCorrection && (
            <Badge variant="outline" className="mt-1 border-neutral-400 text-neutral-700">
              Correction of {receipt.correctionOfReceipt}
            </Badge>
          )}
        </div>
      </header>

      <section className="mt-5 grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Received from</p>
          <p className="font-medium">{receipt.student.name}</p>
          <p className="text-neutral-600">Enrollment no. {receipt.student.enrollmentNumber}</p>
          {receipt.guardianName && <p className="text-neutral-600">Guardian: {receipt.guardianName}</p>}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Towards</p>
          <p className="font-medium">{receipt.student.courseName}</p>
          <p className="text-neutral-600">
            {receipt.student.divisionName ? `${receipt.student.divisionName} · ` : ""}
            {receipt.planName}
          </p>
        </div>
      </section>

      <section className="mt-6">
        <Row label="Installment" value={receipt.installmentLabel ?? "General payment"} />
        <Row label="Payment mode" value={receipt.mode.replace("_", " ")} />
        <Row label="Amount received" value={inr(receipt.amount)} strong />
        <Row label="In words" value={<span className="italic">{amountInWords(receipt.amount)}</span>} />
        {receipt.note && <Row label="Note" value={receipt.note} />}
      </section>

      <section className="mt-6 rounded-md bg-neutral-100 p-4 text-sm print:border print:border-neutral-300 print:bg-transparent">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-neutral-500">Plan total</p>
            <p className="font-semibold">{inr(receipt.planTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Paid to date</p>
            <p className="font-semibold">{inr(receipt.paidToDate)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Balance after this receipt</p>
            <p className="font-semibold">{inr(receipt.balanceAfter)}</p>
          </div>
        </div>
      </section>

      {receipt.correctedByReceipt && (
        <p className="mt-4 text-xs text-neutral-600">
          This receipt was later corrected by {receipt.correctedByReceipt}. The corrected amount is on that receipt.
        </p>
      )}

      <footer className="mt-8 flex items-end justify-between gap-6 border-t border-neutral-300 pt-4 text-xs text-neutral-600">
        <div>
          <p>Collected by {receipt.collectedBy}</p>
          <p>Issued {date(receipt.issuedAt)} · System-generated receipt, valid without signature.</p>
        </div>
        <div className="text-right">
          <div className="mb-1 h-8 w-40 border-b border-neutral-400" aria-hidden />
          <p>Authorised signatory</p>
        </div>
      </footer>
    </article>
  );
}
