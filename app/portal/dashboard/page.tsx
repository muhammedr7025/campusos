import { ClipboardList, FileText, Wallet, Users } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getPortalStudents, getActiveStudentId } from "@/lib/portal/context";
import { getCurrentFeePlanForStudent } from "@/lib/fees/balance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";
import { ChildSwitcher } from "@/components/portal/child-switcher";

export default async function PortalDashboardPage() {
  const session = await requireRole(Role.STUDENT, Role.PARENT);
  const tenantId = await getTenantId();

  const students = await getPortalStudents(tenantId, session.user.id, session.user.role);
  const activeStudentId = await getActiveStudentId(students);

  if (!activeStudentId) {
    return <EmptyState icon={Users} title="No student profile linked yet" description="Contact your institute if this seems wrong." />;
  }

  const activeStudent = students.find((s) => s.id === activeStudentId)!;

  const [attendanceRecords, pendingAssignments, feeDetail] = await Promise.all([
    prisma.attendance.findMany({ where: { tenantId, studentId: activeStudentId }, select: { status: true } }),
    prisma.submission.count({ where: { tenantId, studentId: activeStudentId, status: "MISSING" } }),
    getCurrentFeePlanForStudent(tenantId, activeStudentId),
  ]);

  const present = attendanceRecords.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const attendancePct = attendanceRecords.length > 0 ? Math.round((present / attendanceRecords.length) * 100) : null;

  const cards = [
    { label: "Attendance", value: attendancePct != null ? `${attendancePct}%` : "—", icon: ClipboardList },
    { label: "Assignments pending", value: pendingAssignments, icon: FileText },
    { label: "Fee balance", value: feeDetail ? `₹${feeDetail.balance.toLocaleString("en-IN")}` : "—", icon: Wallet },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{activeStudent.name}</h1>
          <p className="text-muted-foreground text-sm">{activeStudent.courseName} · {activeStudent.divisionName ?? "No division"}</p>
        </div>
        <ChildSwitcher students={students} activeStudentId={activeStudentId} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
