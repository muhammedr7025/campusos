import { Users } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getPortalStudents, getActiveStudentId } from "@/lib/portal/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ChildSwitcher } from "@/components/portal/child-switcher";

export default async function PortalAttendancePage() {
  const session = await requireRole(Role.STUDENT, Role.PARENT);
  const tenantId = await getTenantId();

  const students = await getPortalStudents(tenantId, session.user.id, session.user.role);
  const activeStudentId = await getActiveStudentId(students);
  if (!activeStudentId) {
    return <EmptyState icon={Users} title="No student profile linked yet" />;
  }

  const records = await prisma.attendance.findMany({
    where: { tenantId, studentId: activeStudentId },
    include: { subject: true },
    orderBy: { date: "desc" },
  });

  const bySubject = new Map<string, { name: string; present: number; total: number }>();
  for (const r of records) {
    const entry = bySubject.get(r.subjectId) ?? { name: r.subject.name, present: 0, total: 0 };
    entry.total += 1;
    if (r.status === "PRESENT" || r.status === "LATE") entry.present += 1;
    bySubject.set(r.subjectId, entry);
  }

  const overallPresent = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const overallPct = records.length > 0 ? Math.round((overallPresent / records.length) * 100) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Student"
        title="My attendance"
        description={`Overall: ${overallPct != null ? `${overallPct}%` : "No records yet"}`}
        actions={<ChildSwitcher students={students} activeStudentId={activeStudentId} />}
      />

      {bySubject.size === 0 ? (
        <EmptyState icon={Users} title="No attendance recorded yet" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...bySubject.entries()].map(([subjectId, s]) => {
            const pct = Math.round((s.present / s.total) * 100);
            return (
              <Card key={subjectId}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{s.name}</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{pct}%</span>
                  <Badge variant={pct < 75 ? "destructive" : "secondary"}>{s.present}/{s.total}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent records</h2>
        <div className="flex flex-col gap-2">
          {records.slice(0, 20).map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-center justify-between p-3 text-sm">
                <span>{r.subject.name} · {r.date.toLocaleDateString()}</span>
                <Badge variant={r.status === "PRESENT" || r.status === "LATE" ? "default" : "destructive"}>{r.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
