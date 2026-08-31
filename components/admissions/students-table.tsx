"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";

export type StudentRow = {
  id: string;
  name: string;
  enrollmentNumber: string;
  courseName: string;
  divisionName: string | null;
  status: "KYC_PENDING" | "ACTIVE" | "INACTIVE";
};

export function StudentsTable({ students }: { students: StudentRow[] }) {
  const columns = useMemo<ColumnDef<StudentRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link href={`/admissions/students/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { accessorKey: "enrollmentNumber", header: "Enrollment #" },
      { accessorKey: "courseName", header: "Course" },
      { id: "division", header: "Division", cell: ({ row }) => row.original.divisionName ?? "—" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge variant={row.original.status === "ACTIVE" ? "default" : "secondary"}>{row.original.status}</Badge>,
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={students}
      searchKey="name"
      searchPlaceholder="Search students…"
      emptyIcon={GraduationCap}
      emptyTitle="No students yet"
      emptyDescription="Admitted students appear here once a lead is converted."
      renderMobileCard={(student) => (
        <Link href={`/admissions/students/${student.id}`}>
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{student.name}</p>
                <p className="text-muted-foreground text-sm">{student.enrollmentNumber} · {student.courseName}</p>
              </div>
              <Badge variant={student.status === "ACTIVE" ? "default" : "secondary"}>{student.status}</Badge>
            </CardContent>
          </Card>
        </Link>
      )}
    />
  );
}
