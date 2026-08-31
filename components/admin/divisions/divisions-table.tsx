"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type ColumnDef } from "@tanstack/react-table";
import { Trash2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/data-table/data-table";
import { DivisionFormDialog } from "@/components/admin/divisions/division-form-dialog";
import { deleteDivision } from "@/lib/actions/academic";

export type DivisionRow = {
  id: string;
  name: string;
  courseName: string;
  capacity: number | null;
  studentCount: number;
};

function DeleteDivisionButton({ division }: { division: DivisionRow }) {
  const router = useRouter();

  async function onDelete() {
    const result = await deleteDivision(division.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Division "${division.name}" deleted.`);
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Delete division">
          <Trash2 className="text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {division.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This can&apos;t be undone. Divisions with enrolled students can&apos;t be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DivisionsTable({ divisions, courses }: { divisions: DivisionRow[]; courses: { id: string; name: string }[] }) {
  const columns = useMemo<ColumnDef<DivisionRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link href={`/admin/divisions/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { accessorKey: "courseName", header: "Course" },
      {
        id: "capacity",
        header: "Capacity",
        cell: ({ row }) => {
          const { studentCount, capacity } = row.original;
          const full = capacity != null && studentCount >= capacity;
          return (
            <Badge variant={full ? "destructive" : "secondary"}>
              {studentCount}
              {capacity != null ? ` / ${capacity}` : ""}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DeleteDivisionButton division={row.original} />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={divisions}
      searchKey="name"
      searchPlaceholder="Search divisions…"
      emptyIcon={GraduationCap}
      emptyTitle="No divisions yet"
      emptyDescription="Add your first section under a course."
      emptyAction={<DivisionFormDialog courses={courses} />}
      toolbar={<DivisionFormDialog courses={courses} />}
      renderMobileCard={(division) => (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <Link href={`/admin/divisions/${division.id}`} className="font-medium hover:underline">
                {division.name}
              </Link>
              <p className="text-muted-foreground text-sm">{division.courseName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {division.studentCount}
                {division.capacity != null ? ` / ${division.capacity}` : ""}
              </Badge>
              <DeleteDivisionButton division={division} />
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
