import { History } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { AuditTable, type AuditRow } from "@/components/admin/audit-table";

/**
 * The counselor's own slice of the audit log. Deliberately self-scoped: a
 * counselor sees what they did, not what the institute did — the full log
 * stays with Admin and Finance.
 */
export default async function MyActivityPage() {
  const session = await requireRole(Role.SUPER_ADMIN, Role.COUNSELOR);
  const tenantId = await getTenantId();

  const logs = await prisma.auditLog.findMany({
    where: { tenantId, actorId: session.user.id },
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
        crumb="CRM"
        title="My activity"
        description="Every lead, follow-up and conversion you've recorded — your most recent 200 entries."
      />

      {rows.length === 0 ? (
        <EmptyState icon={History} title="Nothing logged yet" description="Your actions appear here as you work leads." />
      ) : (
        <AuditTable rows={rows} />
      )}
    </div>
  );
}
