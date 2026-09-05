import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";
import { DuesFilterBar } from "@/components/finance/dues-filter-bar";
import { DuesTable } from "@/components/finance/dues-table";
import { PageHeader } from "@/components/layout/page-header";

export default async function DuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  const tenantId = await getTenantId();
  const params = await searchParams;

  const [plans, courses] = await Promise.all([
    getFeeSummaryForTenant(tenantId, { courseId: params.course }),
    prisma.course.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const filtered = plans.filter((p) => {
    if (params.status === "overdue") return p.isOverdue;
    if (params.status === "pending") return p.balance > 0 && !p.isOverdue;
    if (params.status === "paid") return p.balance === 0;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="Finance" title="Dues" description="Who&apos;s paid, who&apos;s pending, who&apos;s overdue." />
      <DuesFilterBar courses={courses} />
      <DuesTable plans={filtered} />
    </div>
  );
}
