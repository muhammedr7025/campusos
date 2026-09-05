import { Wallet, AlertCircle, Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
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
      <PageHeader crumb="Finance" title="Collections overview" description="Collection status across all students." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} icon={card.icon} />
        ))}
      </div>
    </div>
  );
}
