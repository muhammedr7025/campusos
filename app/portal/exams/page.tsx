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
import { FilterPills } from "@/components/layout/filter-pills";

export default async function PortalExamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireRole(Role.STUDENT, Role.PARENT);
  const tenantId = await getTenantId();
  const params = await searchParams;

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

  // An exam the student hasn't been graded on yet is still theirs to know
  // about — showing only marked papers hid the entire upcoming schedule.
  const entries = exams.map((exam) => {
    const myMark = exam.marks.find((m) => m.studentId === activeStudentId);
    const classAvg = exam.marks.length > 0
      ? exam.marks.reduce((sum, m) => sum + Number(m.score), 0) / exam.marks.length
      : null;
    return {
      id: exam.id,
      name: exam.name,
      subject: exam.subject.name,
      date: exam.date,
      syllabus: exam.syllabus,
      maxMarks: exam.maxMarks,
      score: myMark ? Number(myMark.score) : null,
      classAvg: myMark ? classAvg : null,
    };
  });

  const view = params.view === "results" ? "results" : params.view === "upcoming" ? "upcoming" : "All";
  const results = entries.filter((e) =>
    view === "results" ? e.score != null : view === "upcoming" ? e.score == null : true,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Academics"
        title="Exams & results"
        description="Everything scheduled for this division, and your marks once a paper is graded."
        actions={<ChildSwitcher students={students} activeStudentId={activeStudentId} />}
      />

      <FilterPills options={["All", "upcoming", "results"]} active={view} paramKey="view" />

      {results.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={view === "results" ? "Nothing graded yet" : view === "upcoming" ? "Nothing scheduled" : "No exams yet"}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {results.map((r) => {
            const pct = r.score != null ? Math.round((r.score / r.maxMarks) * 100) : null;
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-muted-foreground text-sm">{r.subject}</p>
                    </div>
                    {r.score != null && pct != null ? (
                      <Badge variant={pct >= 50 ? "secondary" : "destructive"}>
                        {r.score}/{r.maxMarks}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not graded</Badge>
                    )}
                  </div>
                  {r.syllabus && <p className="text-muted-foreground text-xs">Portion: {r.syllabus}</p>}
                  <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                    <span>{new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    <span>Max {r.maxMarks}</span>
                    {pct != null && <span>{pct}%</span>}
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
