"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import { LogFollowUpDialog } from "@/components/crm/log-follow-up-dialog";
import { LeadStatusBadge } from "@/components/crm/lead-status-badge";
import type { LeadStatus } from "@/generated/prisma/client";

export type FollowUpRow = {
  id: string;
  name: string;
  phone: string;
  courseName: string | null;
  source: string;
  status: LeadStatus;
  counselorName: string | null;
  dueAt: string | null;
  isOverdue: boolean;
};

function Due({ row }: { row: FollowUpRow }) {
  if (!row.dueAt) return <span className="text-muted-foreground">—</span>;
  const date = new Date(row.dueAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return row.isOverdue ? (
    <span className="text-destructive font-semibold">
      {date} <span className="font-normal">· overdue</span>
    </span>
  ) : (
    <span className="tabular-nums">{date}</span>
  );
}

export function FollowUpsTable({ rows }: { rows: FollowUpRow[] }) {
  const columns = useMemo<ColumnDef<FollowUpRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Lead",
        cell: ({ row }) => (
          <div>
            <Link href={`/crm/leads/${row.original.id}`} className="font-medium hover:underline">
              {row.original.name}
            </Link>
            <p className="text-muted-foreground text-xs">{row.original.phone}</p>
          </div>
        ),
      },
      { id: "course", header: "Course interest", cell: ({ row }) => row.original.courseName ?? "—" },
      { id: "source", header: "Source", cell: ({ row }) => row.original.source.replace("_", " ") },
      { id: "status", header: "Stage", cell: ({ row }) => <LeadStatusBadge status={row.original.status} /> },
      { id: "due", header: "Next follow-up", cell: ({ row }) => <Due row={row.original} /> },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <LogFollowUpDialog
              leadId={row.original.id}
              leadName={row.original.name}
              trigger={<Button size="sm">Log follow-up</Button>}
            />
            <Button asChild size="sm" variant="outline">
              <Link href={`/crm/leads/${row.original.id}`}>Open</Link>
            </Button>
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
      searchKey="name"
      searchPlaceholder="Search leads…"
      emptyIcon={CalendarClock}
      emptyTitle="Nothing due"
      renderMobileCard={(row) => (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/crm/leads/${row.id}`} className="font-medium hover:underline">
                  {row.name}
                </Link>
                <p className="text-muted-foreground text-sm">{row.phone}</p>
                <p className="text-muted-foreground text-xs">
                  {row.courseName ?? "No course"} · {row.source.replace("_", " ")}
                </p>
              </div>
              {row.isOverdue ? <Badge variant="destructive">Overdue</Badge> : <LeadStatusBadge status={row.status} />}
            </div>
            <p className="text-sm">
              <Due row={row} />
            </p>
            <div className="flex gap-2">
              <LogFollowUpDialog
                leadId={row.id}
                leadName={row.name}
                trigger={<Button size="sm">Log follow-up</Button>}
              />
              <Button asChild size="sm" variant="outline">
                <Link href={`/crm/leads/${row.id}`}>Open</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
