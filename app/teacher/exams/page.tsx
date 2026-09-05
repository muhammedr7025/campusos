import Link from "next/link";
import { GraduationCap, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { ExamFormDialog } from "@/components/teacher/exam-form-dialog";
import { DeleteExamButton } from "@/components/teacher/delete-exam-button";

export default async function TeacherExamsPage() {
  const session = await requireRole(Role.SUPER_ADMIN, Role.TEACHER);
  const tenantId = await getTenantId();

  const myTimetable = await prisma.timetable.findMany({
    where: { tenantId, teacherId: session.user.id },
    include: { division: { select: { id: true, name: true, courseId: true } }, subject: { select: { id: true, name: true, courseId: true } } },
  });

  const isAdmin = session.user.role === Role.SUPER_ADMIN;
  const myDivisionIds = [...new Set(myTimetable.map((t) => t.divisionId))];

  const [divisions, subjects, exams] = await Promise.all([
    prisma.division.findMany({
      where: { tenantId, ...(isAdmin ? {} : { id: { in: myDivisionIds } }) },
      select: { id: true, name: true, courseId: true, course: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.subject.findMany({
      where: { tenantId },
      select: { id: true, name: true, courseId: true },
    }),
    prisma.exam.findMany({
      where: { tenantId, ...(isAdmin ? {} : { divisionId: { in: myDivisionIds } }) },
      include: {
        division: { select: { name: true, course: { select: { name: true } } } },
        subject: { select: { name: true } },
        _count: { select: { marks: true } },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  const divisionOptions = divisions.map((d) => ({ id: d.id, name: `${d.course.name} · ${d.name}`, courseId: d.courseId }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Academics"
        title="Exams & marks"
        description="Schedule exams and enter results for your classes."
        actions={<ExamFormDialog divisions={divisionOptions} subjects={subjects} />}
      />

      {exams.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No exams scheduled yet" description="Schedule an exam to start entering marks." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <Card key={exam.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{exam.name}</p>
                    <p className="text-muted-foreground text-sm">{exam.division.course.name} · {exam.division.name} · {exam.subject.name}</p>
                  </div>
                  <DeleteExamButton id={exam.id} name={exam.name} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{new Date(exam.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</Badge>
                  <Badge variant="secondary">Max {exam.maxMarks}</Badge>
                  <span className="text-muted-foreground text-xs">{exam._count.marks} graded</span>
                </div>
                <Button asChild size="sm" variant="outline" className="mt-1 w-fit">
                  <Link href={`/teacher/exams/${exam.id}`}>
                    Enter marks <ChevronRight className="size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
