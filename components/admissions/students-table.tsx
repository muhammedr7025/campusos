"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import { StudentStatusSelect } from "@/components/admissions/student-status-select";
import { DeleteStudentButton } from "@/components/admissions/delete-student-button";

export type StudentRow = {
  id: string;
  name: string;
  enrollmentNumber: string;
  courseName: string;
  divisionName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  attendancePct: number | null;
  balance: number;
  status: "KYC_PENDING" | "ACTIVE" | "INACTIVE";
};

function Attendance({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-muted-foreground">—</span>;
  return <span className={pct < 75 ? "text-destructive font-semibold" : "text-primary font-semibold"}>{pct}%</span>;
}

function Fees({ balance }: { balance: number }) {
  if (balance <= 0) return <span className="text-primary">Clear</span>;
  return <span className="text-destructive tabular-nums">₹{balance.toLocaleString("en-IN")} due</span>;
}

export function StudentsTable({ students, canDelete = false }: { students: StudentRow[]; canDelete?: boolean }) {
  const columns = useMemo<ColumnDef<StudentRow>[]>(
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
        id: "guardian",
        header: "Parent",
        cell: ({ row }) =>
          row.original.guardianName ? (
            <div>
              <p>{row.original.guardianName}</p>
              <p className="text-muted-foreground text-xs">{row.original.guardianPhone ?? ""}</p>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { id: "attendance", header: "Attendance", cell: ({ row }) => <Attendance pct={row.original.attendancePct} /> },
      { id: "fees", header: "Fees", cell: ({ row }) => <Fees balance={row.original.balance} /> },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StudentStatusSelect studentId={row.original.id} status={row.original.status} />,
      },
      ...(canDelete
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }) => (
                <div className="flex justify-end">
                  <DeleteStudentButton id={row.original.id} name={row.original.name} />
                </div>
              ),
            } satisfies ColumnDef<StudentRow>,
          ]
        : []),
    ],
    [canDelete],
  );

  return (
    <DataTable
      columns={columns}
      data={students}
      searchKey="name"
      searchPlaceholder="Search students…"
      emptyIcon={GraduationCap}
      emptyTitle="No students yet"
      emptyDescription="Admit a walk-in directly, or convert a lead from the CRM."
      renderMobileCard={(student) => (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admissions/students/${student.id}`} className="font-medium hover:underline">
                  {student.name}
                </Link>
                <p className="text-muted-foreground text-sm">
                  {student.enrollmentNumber} · {student.courseName}
                </p>
                {student.guardianName && (
                  <p className="text-muted-foreground text-xs">Parent: {student.guardianName}</p>
                )}
              </div>
              <Badge variant={student.status === "ACTIVE" ? "default" : "secondary"}>{student.status}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span>
                Attendance <Attendance pct={student.attendancePct} />
              </span>
              <Fees balance={student.balance} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <StudentStatusSelect studentId={student.id} status={student.status} />
              {canDelete && <DeleteStudentButton id={student.id} name={student.name} />}
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
