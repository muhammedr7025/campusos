import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { BatchesTable, type BatchRow } from "@/components/admin/batches/batches-table";

export default async function BatchesPage() {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();

  const batches = await prisma.batch.findMany({
    where: { tenantId },
    include: { _count: { select: { courses: true } } },
    orderBy: { startYear: "desc" },
  });

  const rows: BatchRow[] = batches.map((b) => ({
    id: b.id,
    name: b.name,
    startYear: b.startYear,
    endYear: b.endYear,
    status: b.status,
    courseCount: b._count.courses,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
        <p className="text-muted-foreground text-sm">Academic-year cohorts that group your courses.</p>
      </div>
      <BatchesTable batches={rows} />
    </div>
  );
}
