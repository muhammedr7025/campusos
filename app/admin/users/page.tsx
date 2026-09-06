import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { UsersTable, type UserRow } from "@/components/admin/users/users-table";
import { PageHeader } from "@/components/layout/page-header";
import { FilterPills } from "@/components/layout/filter-pills";

const STATUSES = ["All", "Active", "Suspended"] as const;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();
  const params = await searchParams;
  const filter = (STATUSES as readonly string[]).includes(params.status ?? "") ? params.status! : "All";

  const users = await prisma.user.findMany({
    where: {
      tenantId,
      role: { in: [Role.SUPER_ADMIN, Role.FINANCE, Role.COUNSELOR, Role.ADMISSION_OFFICER, Role.TEACHER] },
      ...(filter === "All" ? {} : { isActive: filter === "Active" }),
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="Governance" title="Users & roles" description="Staff accounts. Student/parent logins are created automatically at admission." />
      <FilterPills options={[...STATUSES]} active={filter} paramKey="status" />
      <UsersTable users={rows} />
    </div>
  );
}
