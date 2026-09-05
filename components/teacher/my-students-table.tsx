"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";

export type MyStudentRow = {
  id: string;
  name: string;
  enrollmentNumber: string;
  divisionName: string;
  courseName: string;
  attendancePct: number | null;
  submitted: number;
  posted: number;
  avgMarks: number | null;
  risk: boolean;
};

function StandingBadge({ risk }: { risk: boolean }) {
  return risk ? (
    <Badge variant="destructive">Needs attention</Badge>
  ) : (
    <Badge variant="secondary">On track</Badge>
  );
}

export function MyStudentsTable({ rows }: { rows: MyStudentRow[] }) {
  const columns = useMemo<ColumnDef<MyStudentRow>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-muted-foreground text-xs">{row.original.enrollmentNumber}</p>
          </div>
        ),
      },
      { id: "division", header: "Division", cell: ({ row }) => `${row.original.courseName} · ${row.original.divisionName}` },
      {
        id: "attendance",
        header: "Attendance",
        cell: ({ row }) =>
          row.original.attendancePct != null ? (
            <span className={row.original.attendancePct < 75 ? "font-semibold text-destructive" : "font-semibold text-primary"}>
              {row.original.attendancePct}%
            </span>
          ) : (
            "—"
          ),
      },
      {
        id: "submissions",
        header: "Submissions",
        cell: ({ row }) => `${row.original.submitted} / ${row.original.posted}`,
      },
      {
        id: "avgMarks",
        header: "Avg marks",
        cell: ({ row }) =>
          row.original.avgMarks != null ? (
            <span className={row.original.avgMarks < 50 ? "text-destructive" : undefined}>{row.original.avgMarks}%</span>
          ) : (
            "—"
          ),
      },
      { id: "standing", header: "Standing", cell: ({ row }) => <StandingBadge risk={row.original.risk} /> },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchKey="name"
      searchPlaceholder="Search students…"
      emptyIcon={Users}
      emptyTitle="No students assigned to your classes yet"
      renderMobileCard={(s) => (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-muted-foreground text-sm">{s.courseName} · {s.divisionName}</p>
              </div>
              <StandingBadge risk={s.risk} />
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
              <span>Attendance {s.attendancePct != null ? `${s.attendancePct}%` : "—"}</span>
              <span>Submissions {s.submitted}/{s.posted}</span>
              <span>Avg marks {s.avgMarks != null ? `${s.avgMarks}%` : "—"}</span>
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
