import { Wallet, AlertCircle, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";

export default async function FinanceDashboardPage() {
  await requireRole(Role.SUPER_ADMIN, Role.FINANCE);
  const tenantId = await getTenantId();

  const [plans, paymentCountToday] = await Promise.all([
    getFeeSummaryForTenant(tenantId),
    prisma.payment.count({
      where: { tenantId, paidAt: { gte: new Date(new Date().toDateString()) } },
    }),
  ]);

  const totalCollected = plans.reduce((sum, p) => sum + p.paid, 0);
  const totalPending = plans.reduce((sum, p) => sum + p.balance, 0);
  const overdueCount = plans.filter((p) => p.isOverdue).length;

  const cards = [
    { label: "Collected", value: `₹${totalCollected.toLocaleString("en-IN")}`, icon: Wallet },
    { label: "Pending", value: `₹${totalPending.toLocaleString("en-IN")}`, icon: AlertCircle },
    { label: "Overdue students", value: overdueCount, icon: AlertCircle },
    { label: "Payments logged today", value: paymentCountToday, icon: Receipt },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finance dashboard</h1>
        <p className="text-muted-foreground text-sm">Collection status across all students.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">{card.label}</CardTitle>
              <card.icon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
