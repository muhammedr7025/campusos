"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type ColumnDef } from "@tanstack/react-table";
import { Users as UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import { UserFormDialog } from "@/components/admin/users/user-form-dialog";
import { EditUserDialog } from "@/components/admin/users/edit-user-dialog";
import { ResetPasswordButton } from "@/components/admin/users/reset-password-button";
import { setUserActive } from "@/lib/actions/users";
import { ROLE_LABEL } from "@/components/layout/nav-items";
import type { Role } from "@/generated/prisma/client";
import type { UpdateUserInput } from "@/lib/validators/users";

export type UserRow = { id: string; name: string; email: string; phone: string | null; role: Role; isActive: boolean };

function ActiveToggle({ user }: { user: UserRow }) {
  const router = useRouter();
  async function onChange(checked: boolean) {
    const result = await setUserActive(user.id, checked);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }
  return <Switch checked={user.isActive} onCheckedChange={onChange} aria-label="Active" />;
}

function RowActions({ user }: { user: UserRow }) {
  return (
    <div className="flex items-center gap-1">
      <EditUserDialog user={{ id: user.id, name: user.name, phone: user.phone, role: user.role as UpdateUserInput["role"] }} />
      <ResetPasswordButton userId={user.id} email={user.email} />
      <ActiveToggle user={user} />
    </div>
  );
}

export function UsersTable({ users }: { users: UserRow[] }) {
  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email" },
      { id: "role", header: "Role", cell: ({ row }) => <Badge variant="secondary">{ROLE_LABEL[row.original.role]}</Badge> },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActions user={row.original} />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={users}
      searchKey="name"
      searchPlaceholder="Search users…"
      emptyIcon={UsersIcon}
      emptyTitle="No staff accounts yet"
      emptyAction={<UserFormDialog />}
      toolbar={<UserFormDialog />}
      renderMobileCard={(user) => (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-muted-foreground text-sm">{user.email}</p>
              <Badge variant="secondary" className="mt-1">{ROLE_LABEL[user.role]}</Badge>
            </div>
            <RowActions user={user} />
          </CardContent>
        </Card>
      )}
    />
  );
}
