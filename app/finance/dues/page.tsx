import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";
import { DuesFilterBar } from "@/components/finance/dues-filter-bar";
import { DuesTable } from "@/components/finance/dues-table";
import { PageHeader } from "@/components/layout/page-header";
import { FilterPills } from "@/components/layout/filter-pills";

const STATUSES = ["All", "Overdue", "Pending", "Paid"] as const;

export default async function DuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  const tenantId = await getTenantId();
  const params = await searchParams;
  const status = (STATUSES as readonly string[]).includes(params.status ?? "") ? params.status! : "All";

  const [plans, courses] = await Promise.all([
    getFeeSummaryForTenant(tenantId, { courseId: params.course }),
    prisma.course.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const filtered = plans.filter((p) => {
    if (status === "Overdue") return p.isOverdue;
    if (status === "Pending") return p.balance > 0 && !p.isOverdue;
    if (status === "Paid") return p.balance === 0;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Finance"
        title="Student dues"
        description="Balance is always plan total minus verified payments. It is never editable by hand."
      />
      <FilterPills options={[...STATUSES]} active={status} paramKey="status" />
      <DuesFilterBar courses={courses} />
      <DuesTable plans={filtered} />
    </div>
  );
}
