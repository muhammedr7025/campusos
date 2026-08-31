"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Layers, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import { BatchFormDialog } from "@/components/admin/batches/batch-form-dialog";
import { setBatchStatus, deleteBatch } from "@/lib/actions/academic";
import type { BatchStatus } from "@/generated/prisma/client";

export type BatchRow = {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  status: BatchStatus;
  courseCount: number;
};

const STATUS_VARIANT: Record<BatchStatus, "default" | "secondary" | "outline"> = {
  UPCOMING: "secondary",
  ACTIVE: "default",
  ARCHIVED: "outline",
};

function DeleteBatchButton({ batch }: { batch: BatchRow }) {
  const router = useRouter();

  async function onDelete() {
    const result = await deleteBatch(batch.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Batch "${batch.name}" deleted.`);
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Delete batch">
          <Trash2 className="text-destructive size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {batch.name}?</AlertDialogTitle>
          <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RowActions({ batch }: { batch: BatchRow }) {
  const router = useRouter();

  async function changeStatus(status: BatchStatus) {
    const result = await setBatchStatus(batch.id, status);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${batch.name} is now ${status.toLowerCase()}.`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <BatchFormDialog batch={batch} />
      {batch.courseCount === 0 && <DeleteBatchButton batch={batch} />}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Batch actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {batch.status === "UPCOMING" && (
            <DropdownMenuItem onSelect={() => changeStatus("ACTIVE")}>Activate</DropdownMenuItem>
          )}
          {batch.status === "ACTIVE" && (
            <DropdownMenuItem onSelect={() => changeStatus("ARCHIVED")}>Archive</DropdownMenuItem>
          )}
          {batch.status === "ARCHIVED" && (
            <DropdownMenuItem onSelect={() => changeStatus("ACTIVE")}>Reactivate</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function BatchesTable({ batches }: { batches: BatchRow[] }) {
  const columns = useMemo<ColumnDef<BatchRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link href={`/admin/batches/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      {
        id: "years",
        header: "Academic years",
        cell: ({ row }) => `${row.original.startYear}–${row.original.endYear}`,
      },
      { accessorKey: "courseCount", header: "Courses" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>,
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActions batch={row.original} />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={batches}
      searchKey="name"
      searchPlaceholder="Search batches…"
      emptyIcon={Layers}
      emptyTitle="No batches yet"
      emptyDescription="Create your first academic-year batch to start organizing courses."
      emptyAction={<BatchFormDialog />}
      toolbar={<BatchFormDialog />}
      renderMobileCard={(batch) => (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <Link href={`/admin/batches/${batch.id}`} className="font-medium hover:underline">
                {batch.name}
              </Link>
              <p className="text-muted-foreground text-sm">
                {batch.startYear}–{batch.endYear} · {batch.courseCount} course{batch.courseCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[batch.status]}>{batch.status}</Badge>
              <RowActions batch={batch} />
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
