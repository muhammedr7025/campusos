import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { BulkImportView } from "@/components/crm/bulk-import-view";

export default async function BulkImportPage() {
  await requireRole(Role.SUPER_ADMIN, Role.COUNSELOR);
  const tenantId = await getTenantId();

  const courses = await prisma.course.findMany({ where: { tenantId }, select: { name: true } });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="CRM" title="Bulk import leads" description="Paste a sheet to capture many leads at once." />
      <BulkImportView courseNames={courses.map((c) => c.name)} />
    </div>
  );
}
