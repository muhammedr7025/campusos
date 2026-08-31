import { Users, GraduationCap, Contact, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";

async function getStats(tenantId: string) {
  const [studentCount, activeLeadCount, courseCount, pendingKycCount] = await Promise.all([
    prisma.student.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.lead.count({ where: { tenantId, status: { notIn: ["CONVERTED", "LOST"] } } }),
    prisma.course.count({ where: { tenantId } }),
    prisma.kycDocument.count({ where: { tenantId, status: { in: ["PENDING", "SUBMITTED"] } } }),
  ]);
  return { studentCount, activeLeadCount, courseCount, pendingKycCount };
}

export default async function AdminDashboardPage() {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();
  const stats = await getStats(tenantId);

  const cards = [
    { label: "Active students", value: stats.studentCount, icon: GraduationCap },
    { label: "Open leads", value: stats.activeLeadCount, icon: Contact },
    { label: "Courses", value: stats.courseCount, icon: Wallet },
    { label: "KYC pending", value: stats.pendingKycCount, icon: Users },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Institute-wide overview.</p>
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
