"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { AlertCircle, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import type { FeePlanSummary } from "@/lib/fees/balance";

function StatusBadge({ plan }: { plan: FeePlanSummary }) {
  if (plan.balance === 0) return <Badge variant="default">Paid</Badge>;
  if (plan.isOverdue) return <Badge variant="destructive" className="gap-1"><AlertCircle className="size-3" /> Overdue</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

export function DuesTable({ plans }: { plans: FeePlanSummary[] }) {
  const columns = useMemo<ColumnDef<FeePlanSummary>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        cell: ({ row }) => (
          <Link href={`/finance/payments/${row.original.studentId}`} className="font-medium hover:underline">
            {row.original.studentName}
          </Link>
        ),
      },
      { accessorKey: "enrollmentNumber", header: "Enrollment #" },
      { id: "total", header: "Total", cell: ({ row }) => `₹${row.original.total.toLocaleString("en-IN")}` },
      { id: "paid", header: "Paid", cell: ({ row }) => `₹${row.original.paid.toLocaleString("en-IN")}` },
      { id: "balance", header: "Balance", cell: ({ row }) => `₹${row.original.balance.toLocaleString("en-IN")}` },
      {
        id: "nextDue",
        header: "Next due",
        cell: ({ row }) => (row.original.nextDueDate ? new Date(row.original.nextDueDate).toLocaleDateString() : "—"),
      },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge plan={row.original} /> },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={plans}
      searchKey="studentName"
      searchPlaceholder="Search students…"
      emptyIcon={Wallet}
      emptyTitle="No fee plans match these filters"
      renderMobileCard={(plan) => (
        <Link href={`/finance/payments/${plan.studentId}`}>
          <Card>
            <CardContent className="flex flex-col gap-1 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{plan.studentName}</p>
                <StatusBadge plan={plan} />
              </div>
              <p className="text-muted-foreground text-sm">
                ₹{plan.paid.toLocaleString("en-IN")} / ₹{plan.total.toLocaleString("en-IN")} paid
              </p>
            </CardContent>
          </Card>
        </Link>
      )}
    />
  );
}
