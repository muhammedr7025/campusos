import { Role } from "@/generated/prisma/client";
import { requireRole, requireSession } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { DiscountRequestDialog } from "@/components/finance/discount-request-dialog";
import { DiscountDecisionButtons } from "@/components/finance/discount-decision-buttons";
import { ScrollText } from "lucide-react";

const STATUS_VARIANT = { PENDING: "warning", APPROVED: "default", REJECTED: "destructive" } as const;

export default async function DiscountsPage() {
  const session = await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  await requireSession();
  const tenantId = await getTenantId();

  const [requests, students] = await Promise.all([
    prisma.discountRequest.findMany({
      where: { tenantId },
      include: { student: { select: { name: true, enrollmentNumber: true } }, requestedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.student.findMany({ where: { tenantId }, select: { id: true, name: true, enrollmentNumber: true }, orderBy: { name: "asc" } }),
  ]);

  const canDecide = session.user.role === Role.SUPER_ADMIN;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Finance"
        title="Discounts & approvals"
        description="Overrides change the fee structure, never the balance. Every approval records who signed it off and why."
        actions={<DiscountRequestDialog students={students} />}
      />

      {requests.length === 0 ? (
        <EmptyState icon={ScrollText} title="No discount requests yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    {r.student.name} <span className="text-muted-foreground text-xs">({r.student.enrollmentNumber})</span>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {r.kind} · ₹{Number(r.amount).toLocaleString("en-IN")} · {r.reason}
                  </p>
                  <p className="text-muted-foreground text-xs">Requested by {r.requestedBy.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                  {r.status === "PENDING" && canDecide && <DiscountDecisionButtons discountId={r.id} />}
                  {r.status === "PENDING" && !canDecide && (
                    <span className="text-muted-foreground text-xs">Awaiting Super Admin</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
