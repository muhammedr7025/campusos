import { GraduationCap, Users } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getPortalStudents, getActiveStudentId } from "@/lib/portal/context";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { ChildSwitcher } from "@/components/portal/child-switcher";

export default async function PortalExamsPage() {
  const session = await requireRole(Role.STUDENT, Role.PARENT);
  const tenantId = await getTenantId();

  const students = await getPortalStudents(tenantId, session.user.id, session.user.role);
  const activeStudentId = await getActiveStudentId(students);
  if (!activeStudentId) {
    return <EmptyState icon={Users} title="No student profile linked yet" />;
  }
  const activeStudent = students.find((s) => s.id === activeStudentId)!;

  const exams = activeStudent.divisionId
    ? await prisma.exam.findMany({
        where: { tenantId, divisionId: activeStudent.divisionId },
        include: { subject: { select: { name: true } }, marks: { select: { studentId: true, score: true } } },
        orderBy: { date: "desc" },
      })
    : [];

  const results = exams
    .map((exam) => {
      const myMark = exam.marks.find((m) => m.studentId === activeStudentId);
      if (!myMark) return null;
      const classAvg = exam.marks.length > 0
        ? exam.marks.reduce((sum, m) => sum + Number(m.score), 0) / exam.marks.length
        : null;
      return {
        id: exam.id,
        name: exam.name,
        subject: exam.subject.name,
        date: exam.date,
        maxMarks: exam.maxMarks,
        score: Number(myMark.score),
        classAvg,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Academics"
        title="Exam results"
        description="Published results for your division, with the class average."
        actions={<ChildSwitcher students={students} activeStudentId={activeStudentId} />}
      />

      {results.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No results published yet" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {results.map((r) => {
            const pct = Math.round((r.score / r.maxMarks) * 100);
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-muted-foreground text-sm">{r.subject}</p>
                    </div>
                    <Badge variant={pct >= 50 ? "secondary" : "destructive"}>
                      {r.score}/{r.maxMarks}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    <span>{new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    <span>{pct}%</span>
                    {r.classAvg != null && <span>Class avg {r.classAvg.toFixed(1)}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
