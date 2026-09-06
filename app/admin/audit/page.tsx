import { History } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "warning"> = {
  DELETE: "destructive",
  REJECT: "destructive",
  UPDATE: "warning",
  UPDATE_STATUS: "warning",
  CORRECT: "warning",
  REASSIGN_DIVISION: "warning",
};

export default async function AuditLogPage() {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  const tenantId = await getTenantId();

  const logs = await prisma.auditLog.findMany({
    where: { tenantId },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Governance"
        title="Audit log"
        description="Append-only. Every financially or academically consequential write lands here — most recent 200 entries."
      />

      {logs.length === 0 ? (
        <EmptyState icon={History} title="Nothing logged yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-3.5 text-sm">
                <span className="text-muted-foreground w-[150px] shrink-0 text-xs tabular-nums">
                  {log.createdAt.toLocaleString()}
                </span>
                <span className="w-[130px] shrink-0 truncate font-medium">{log.actor?.name ?? "System"}</span>
                <Badge variant={ACTION_VARIANT[log.action] ?? "default"} className="shrink-0">
                  {log.action}
                </Badge>
                <span className="text-muted-foreground shrink-0">
                  {log.entityType} · {log.entityId.slice(-8)}
                </span>
                {log.diff != null && (
                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                    {JSON.stringify(log.diff)}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
