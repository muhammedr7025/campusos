import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { UsersTable, type UserRow } from "@/components/admin/users/users-table";

export default async function UsersPage() {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();

  const users = await prisma.user.findMany({
    where: { tenantId, role: { in: [Role.SUPER_ADMIN, Role.FINANCE, Role.COUNSELOR, Role.ADMISSION_OFFICER, Role.TEACHER] } },
    orderBy: { createdAt: "desc" },
  });

  const rows: UserRow[] = users.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, isActive: u.isActive }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm">Staff accounts. Student/parent logins are created automatically at admission.</p>
      </div>
      <UsersTable users={rows} />
    </div>
  );
}
