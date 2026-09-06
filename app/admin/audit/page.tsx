import { History } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role, type Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { FilterPills } from "@/components/layout/filter-pills";
import { AuditTable, type AuditRow } from "@/components/admin/audit-table";

/** The entity families worth filtering by — money, people, academics, everything else. */
const SCOPES: Record<string, string[]> = {
  Finance: ["Payment", "FeePlan", "FeeStructure", "DiscountRequest", "Reminder", "ReminderBatch"],
  People: ["Student", "User", "ParentGuardian", "KycDocument"],
  Academics: ["Batch", "Course", "Division", "Subject", "Timetable", "Exam", "Mark", "SubjectNote", "Assignment"],
  CRM: ["Lead", "FollowUp"],
};
const SCOPE_OPTIONS = ["All", ...Object.keys(SCOPES)];

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE, Role.ADMISSION_OFFICER);
  const tenantId = await getTenantId();
  const params = await searchParams;
  const scope = SCOPE_OPTIONS.includes(params.scope ?? "") ? params.scope! : "All";

  const where: Prisma.AuditLogWhereInput = {
    tenantId,
    ...(scope === "All" ? {} : { entityType: { in: SCOPES[scope] } }),
  };

  const logs = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const rows: AuditRow[] = logs.map((log) => ({
    id: log.id,
    at: log.createdAt.toISOString(),
    actor: log.actor?.name ?? "System",
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    detail: log.diff == null ? "" : JSON.stringify(log.diff),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Governance"
        title="Audit log"
        description="Append-only. Every financially or academically consequential write lands here — most recent 200 entries."
      />

      <FilterPills options={SCOPE_OPTIONS} active={scope} paramKey="scope" />

      {rows.length === 0 ? (
        <EmptyState icon={History} title={scope === "All" ? "Nothing logged yet" : `No ${scope.toLowerCase()} activity yet`} />
      ) : (
        <AuditTable rows={rows} />
      )}
    </div>
  );
}
