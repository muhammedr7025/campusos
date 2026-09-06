"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";

export type KycRow = {
  id: string;
  name: string;
  enrollmentNumber: string;
  courseName: string;
  divisionName: string | null;
  guardianName: string | null;
  verified: number;
  total: number;
  missing: string[];
  isComplete: boolean;
  status: string;
};

function Missing({ row }: { row: KycRow }) {
  if (row.isComplete) return <span className="text-primary">Nothing pending</span>;
  return <span className="text-destructive">{row.missing.join(", ")}</span>;
}

function StatusBadge({ row }: { row: KycRow }) {
  if (row.isComplete) return <Badge variant="secondary">Complete</Badge>;
  return (
    <Badge variant="destructive">
      {row.missing.length} pending
    </Badge>
  );
}

export function KycTrackerTable({ rows }: { rows: KycRow[] }) {
  const columns = useMemo<ColumnDef<KycRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Student",
        cell: ({ row }) => (
          <div>
            <Link href={`/admissions/students/${row.original.id}`} className="font-medium hover:underline">
              {row.original.name}
            </Link>
            <p className="text-muted-foreground text-xs">{row.original.enrollmentNumber}</p>
          </div>
        ),
      },
      {
        id: "course",
        header: "Course / division",
        cell: ({ row }) => (
          <div>
            <p>{row.original.courseName}</p>
            <p className="text-muted-foreground text-xs">{row.original.divisionName ?? "Unassigned"}</p>
          </div>
        ),
      },
      {
        id: "documents",
        header: "Documents",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.verified} / {row.original.total}
          </span>
        ),
      },
      { id: "missing", header: "Missing", cell: ({ row }) => <Missing row={row.original} /> },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge row={row.original} /> },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admissions/students/${row.original.id}`}>Checklist</Link>
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
      searchPlaceholder="Search students…"
      emptyIcon={ClipboardCheck}
      emptyTitle="Nothing in this view"
      emptyDescription="Admitted students and their document checklists appear here."
      renderMobileCard={(row) => (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admissions/students/${row.id}`} className="font-medium hover:underline">
                  {row.name}
                </Link>
                <p className="text-muted-foreground text-sm">
                  {row.enrollmentNumber} · {row.courseName}
                </p>
              </div>
              <StatusBadge row={row} />
            </div>
            <p className="text-xs">
              <span className="text-muted-foreground">
                {row.verified}/{row.total} verified ·{" "}
              </span>
              <Missing row={row} />
            </p>
            <Button asChild size="sm" variant="outline" className="w-fit">
              <Link href={`/admissions/students/${row.id}`}>Checklist</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    />
  );
}
