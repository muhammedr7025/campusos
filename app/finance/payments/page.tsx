import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";

export default async function PaymentsLedgerPage() {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  const tenantId = await getTenantId();

  const payments = await prisma.payment.findMany({
    where: { tenantId },
    include: { student: { select: { id: true, name: true, enrollmentNumber: true } }, collectedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-muted-foreground text-sm">Most recent 100 entries across all students — the accountability trail.</p>
      </div>

      {payments.length === 0 ? (
        <EmptyState icon={Receipt} title="No payments logged yet" description="Log a payment from a student's fee plan page." />
      ) : (
        <div className="flex flex-col gap-2">
          {payments.map((payment) => (
            <Link key={payment.id} href={`/finance/payments/${payment.student.id}`}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">
                      {payment.student.name} <span className="text-muted-foreground text-xs">({payment.student.enrollmentNumber})</span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {payment.mode.replace("_", " ")} · {payment.paidAt.toLocaleDateString()} · collected by {payment.collectedBy.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {payment.correctionOfId && <Badge variant="outline">Correction</Badge>}
                    <span className={`font-semibold ${Number(payment.amount) < 0 ? "text-destructive" : ""}`}>
                      ₹{Number(payment.amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
