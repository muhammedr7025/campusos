"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";

export type AttendanceReportRow = {
  id: string;
  divisionLabel: string;
  dayTime: string;
  subjectName: string;
  studentCount: number;
  avgAttendance: number | null;
  below75: number;
  sessions: number;
  divisionId: string;
  subjectId: string;
};

function AvgBadge({ avg }: { avg: number | null }) {
  if (avg == null) return <span className="text-muted-foreground">—</span>;
  if (avg >= 85) return <Badge variant="secondary">{avg}%</Badge>;
  if (avg >= 75) return <Badge variant="warning">{avg}%</Badge>;
  return <Badge variant="destructive">{avg}%</Badge>;
}

export function AttendanceReportTable({ rows }: { rows: AttendanceReportRow[] }) {
  const today = new Date().toISOString().slice(0, 10);

  const columns = useMemo<ColumnDef<AttendanceReportRow>[]>(
    () => [
      {
        id: "class",
        header: "Class",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.divisionLabel}</p>
            <p className="text-muted-foreground text-xs">{row.original.dayTime}</p>
          </div>
        ),
      },
      { accessorKey: "subjectName", header: "Subject" },
      { accessorKey: "studentCount", header: "Students" },
      { id: "avgAttendance", header: "Avg attendance", cell: ({ row }) => <AvgBadge avg={row.original.avgAttendance} /> },
      {
        id: "below75",
        header: "Below 75%",
        cell: ({ row }) => (
          <span className={row.original.below75 > 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
            {row.original.below75}
          </span>
        ),
      },
      { accessorKey: "sessions", header: "Sessions" },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button asChild size="sm">
              <Link href={`/teacher/attendance/${row.original.divisionId}?subject=${row.original.subjectId}&date=${today}`}>
                Mark now
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/teacher/students">Students</Link>
            </Button>
          </div>
        ),
      },
    ],
    [today],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchKey="subjectName"
      searchPlaceholder="Search subjects…"
      emptyIcon={BarChart3}
      emptyTitle="No classes on your timetable yet"
      renderMobileCard={(r) => (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{r.divisionLabel}</p>
                <p className="text-muted-foreground text-sm">{r.subjectName} · {r.dayTime}</p>
              </div>
              <AvgBadge avg={r.avgAttendance} />
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
              <span>{r.studentCount} students</span>
              <span>{r.below75} below 75%</span>
              <span>{r.sessions} sessions</span>
            </div>
            <div className="flex gap-2 pt-1">
              <Button asChild size="sm">
                <Link href={`/teacher/attendance/${r.divisionId}?subject=${r.subjectId}&date=${today}`}>Mark now</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/teacher/students">Students</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
