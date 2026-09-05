"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import { SendInviteButton } from "@/components/admissions/send-invite-button";

export type InviteRow = {
  studentId: string;
  studentName: string;
  enrollmentNumber: string;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string | null;
  status: "Not invited" | "Awaiting first login" | "Active";
};

function StatusBadge({ status }: { status: InviteRow["status"] }) {
  if (status === "Active") return <Badge variant="secondary">Active</Badge>;
  if (status === "Awaiting first login") return <Badge variant="warning">Awaiting first login</Badge>;
  return <Badge variant="outline">Not invited</Badge>;
}

export function InvitesTable({ rows }: { rows: InviteRow[] }) {
  const columns = useMemo<ColumnDef<InviteRow>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.studentName}</p>
            <p className="text-muted-foreground text-xs">{row.original.enrollmentNumber}</p>
          </div>
        ),
      },
      { accessorKey: "guardianName", header: "Parent / guardian" },
      { accessorKey: "guardianPhone", header: "Phone" },
      { id: "status", header: "Portal", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <SendInviteButton guardianId={row.original.guardianId} resend={row.original.status !== "Not invited"} />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchKey="studentName"
      searchPlaceholder="Search students or parents…"
      emptyIcon={Megaphone}
      emptyTitle="No admitted students yet"
      renderMobileCard={(r) => (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{r.studentName}</p>
                <p className="text-muted-foreground text-sm">{r.guardianName} · {r.guardianPhone}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <SendInviteButton guardianId={r.guardianId} resend={r.status !== "Not invited"} />
          </CardContent>
        </Card>
      )}
    />
  );
}
