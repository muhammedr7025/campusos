"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import { ReceiptDialog } from "@/components/finance/receipt-dialog";
import { CorrectPaymentDialog } from "@/components/finance/correct-payment-dialog";

export type LedgerRow = {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  enrollmentNumber: string;
  amount: number;
  mode: string;
  paidAt: string;
  collectedBy: string;
  note: string | null;
  isCorrection: boolean;
  /** A payment that has already been corrected can't be corrected again. */
  isCorrected: boolean;
};

function Amount({ amount }: { amount: number }) {
  return (
    <span className={`font-semibold tabular-nums ${amount < 0 ? "text-destructive" : "text-primary"}`}>
      ₹{amount.toLocaleString("en-IN")}
    </span>
  );
}

function RowActions({ row, tenantName }: { row: LedgerRow; tenantName: string }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <ReceiptDialog
        tenantName={tenantName}
        studentName={row.studentName}
        enrollmentNumber={row.enrollmentNumber}
        amount={row.amount}
        mode={row.mode}
        paidAt={row.paidAt}
        collectedBy={row.collectedBy}
        receiptNo={row.receiptNumber}
      />
      {!row.isCorrection && !row.isCorrected && (
        <CorrectPaymentDialog paymentId={row.id} currentAmount={row.amount} />
      )}
    </div>
  );
}

export function PaymentsLedgerTable({ rows, tenantName }: { rows: LedgerRow[]; tenantName: string }) {
  const columns = useMemo<ColumnDef<LedgerRow>[]>(
    () => [
      {
        id: "receipt",
        header: "Receipt",
        cell: ({ row }) => (
          <div>
            <p className="font-medium tabular-nums">{row.original.receiptNumber}</p>
            {row.original.isCorrection ? (
              <Badge variant="warning">Reversal</Badge>
            ) : row.original.isCorrected ? (
              <Badge variant="outline">Corrected</Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "studentName",
        header: "Student",
        cell: ({ row }) => (
          <div>
            <Link href={`/finance/payments/${row.original.studentId}`} className="font-medium hover:underline">
              {row.original.studentName}
            </Link>
            <p className="text-muted-foreground text-xs">{row.original.enrollmentNumber}</p>
          </div>
        ),
      },
      { id: "amount", header: "Amount", cell: ({ row }) => <Amount amount={row.original.amount} /> },
      { id: "mode", header: "Mode", cell: ({ row }) => row.original.mode.replace("_", " ") },
      {
        id: "paidAt",
        header: "Date",
        cell: ({ row }) => <span className="tabular-nums">{row.original.paidAt}</span>,
      },
      { accessorKey: "collectedBy", header: "Collected by" },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <RowActions row={row.original} tenantName={tenantName} />,
      },
    ],
    [tenantName],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchKey="studentName"
      searchPlaceholder="Search by student…"
      emptyIcon={Receipt}
      emptyTitle="No payments logged yet"
      renderMobileCard={(row) => (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/finance/payments/${row.studentId}`} className="font-medium hover:underline">
                  {row.studentName}
                </Link>
                <p className="text-muted-foreground text-xs">
                  {row.receiptNumber} · {row.enrollmentNumber}
                </p>
                <p className="text-muted-foreground text-xs">
                  {row.mode.replace("_", " ")} · {row.paidAt} · {row.collectedBy}
                </p>
              </div>
              <Amount amount={row.amount} />
            </div>
            <div className="flex items-center justify-between gap-2">
              {row.isCorrection ? (
                <Badge variant="warning">Reversal</Badge>
              ) : row.isCorrected ? (
                <Badge variant="outline">Corrected</Badge>
              ) : (
                <span />
              )}
              <RowActions row={row} tenantName={tenantName} />
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
