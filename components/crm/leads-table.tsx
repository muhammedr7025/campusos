"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { AlertCircle, Contact } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import { LeadStatusBadge } from "@/components/crm/lead-status-badge";
import { StageSelect } from "@/components/crm/stage-select";
import type { LeadRow } from "@/components/crm/lead-row-types";

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const columns = useMemo<ColumnDef<LeadRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link href={`/crm/leads/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { accessorKey: "phone", header: "Phone" },
      { id: "course", header: "Course", cell: ({ row }) => row.original.courseName ?? "—" },
      { id: "source", header: "Source", cell: ({ row }) => row.original.source },
      { id: "counselor", header: "Counselor", cell: ({ row }) => row.original.counselorName ?? "—" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <LeadStatusBadge status={row.original.status} />
            {row.original.isOverdue && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="size-3" /> Overdue
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <StageSelect leadId={row.original.id} status={row.original.status} />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={leads}
      searchKey="name"
      searchPlaceholder="Search leads…"
      emptyIcon={Contact}
      emptyTitle="No leads match these filters"
      renderMobileCard={(lead) => (
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between">
              <Link href={`/crm/leads/${lead.id}`} className="font-medium hover:underline">
                {lead.name}
              </Link>
              <LeadStatusBadge status={lead.status} />
            </div>
            <p className="text-muted-foreground text-sm">{lead.phone}</p>
            {lead.courseName && <p className="text-muted-foreground text-sm">{lead.courseName}</p>}
            {lead.isOverdue && (
              <Badge variant="destructive" className="w-fit gap-1">
                <AlertCircle className="size-3" /> Overdue
              </Badge>
            )}
          </CardContent>
        </Card>
      )}
    />
  );
}
