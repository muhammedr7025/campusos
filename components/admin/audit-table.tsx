"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";

export type AuditRow = {
  id: string;
  at: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
};

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "warning"> = {
  DELETE: "destructive",
  REJECT: "destructive",
  UPDATE: "warning",
  UPDATE_STATUS: "warning",
  CORRECT: "warning",
  REASSIGN_DIVISION: "warning",
};

function ActionBadge({ action }: { action: string }) {
  return <Badge variant={ACTION_VARIANT[action] ?? "default"}>{action}</Badge>;
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const columns = useMemo<ColumnDef<AuditRow>[]>(
    () => [
      {
        id: "at",
        header: "When",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs tabular-nums">{new Date(row.original.at).toLocaleString()}</span>
        ),
      },
      { accessorKey: "actor", header: "Actor" },
      { id: "action", header: "Action", cell: ({ row }) => <ActionBadge action={row.original.action} /> },
      {
        id: "entity",
        header: "Entity",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.entityType} · {row.original.entityId.slice(-8)}
          </span>
        ),
      },
      {
        accessorKey: "detail",
        header: "Detail",
        cell: ({ row }) => (
          <span className="text-muted-foreground block max-w-[380px] truncate text-xs" title={row.original.detail}>
            {row.original.detail}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchKey="actor"
      searchPlaceholder="Search by actor…"
      emptyIcon={History}
      emptyTitle="Nothing logged yet"
      renderMobileCard={(row) => (
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-4">
            <div className="flex items-center justify-between gap-2">
              <ActionBadge action={row.action} />
              <span className="text-muted-foreground text-xs tabular-nums">{new Date(row.at).toLocaleString()}</span>
            </div>
            <p className="text-sm font-medium">
              {row.entityType} · {row.actor}
            </p>
            {row.detail && <p className="text-muted-foreground truncate text-xs">{row.detail}</p>}
          </CardContent>
        </Card>
      )}
    />
  );
}
