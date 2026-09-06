"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type ColumnDef } from "@tanstack/react-table";
import { Trash2, BookOpen } from "lucide-react";
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
import { CourseFormDialog } from "@/components/admin/courses/course-form-dialog";
import { deleteCourse } from "@/lib/actions/academic";

export type CourseRow = {
  id: string;
  name: string;
  batchName: string;
  durationLabel: string | null;
  divisionCount: number;
  studentCount: number;
  defaultFee: number | null;
};

function DeleteCourseButton({ course }: { course: CourseRow }) {
  const router = useRouter();

  async function onDelete() {
    const result = await deleteCourse(course.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Course "${course.name}" deleted.`);
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Delete course">
          <Trash2 className="text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {course.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This can&apos;t be undone. Courses with divisions or enrolled students can&apos;t be deleted.
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

export function CoursesTable({ courses, batches }: { courses: CourseRow[]; batches: { id: string; name: string }[] }) {
  const columns = useMemo<ColumnDef<CourseRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link href={`/admin/courses/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { accessorKey: "batchName", header: "Batch" },
      { accessorKey: "durationLabel", header: "Duration", cell: ({ row }) => row.original.durationLabel ?? "—" },
      {
        id: "defaultFee",
        header: "Default fee",
        cell: ({ row }) =>
          row.original.defaultFee == null ? (
            <span className="text-muted-foreground">No plan</span>
          ) : (
            <span className="tabular-nums">₹{row.original.defaultFee.toLocaleString("en-IN")}</span>
          ),
      },
      {
        id: "divisions",
        header: "Divisions",
        cell: ({ row }) => <Badge variant="secondary">{row.original.divisionCount}</Badge>,
      },
      { accessorKey: "studentCount", header: "Students" },
      {
        id: "actions",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DeleteCourseButton course={row.original} />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={courses}
      searchKey="name"
      searchPlaceholder="Search courses…"
      emptyIcon={BookOpen}
      emptyTitle="No courses yet"
      emptyDescription="Add your first course under a batch."
      emptyAction={<CourseFormDialog batches={batches} />}
      toolbar={<CourseFormDialog batches={batches} />}
      renderMobileCard={(course) => (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <Link href={`/admin/courses/${course.id}`} className="font-medium hover:underline">
                {course.name}
              </Link>
              <p className="text-muted-foreground text-sm">
                {course.batchName} · {course.divisionCount} divisions · {course.studentCount} students
                {course.defaultFee != null && ` · ₹${course.defaultFee.toLocaleString("en-IN")}`}
              </p>
            </div>
            <DeleteCourseButton course={course} />
          </CardContent>
        </Card>
      )}
    />
  );
}
