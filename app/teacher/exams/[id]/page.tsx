import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { Role } from "@/generated/prisma/client";
import { teachesClass } from "@/lib/academics/teaching";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Users } from "lucide-react";
import { MarksRoster } from "@/components/teacher/marks-roster";

export default async function ExamMarksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole(Role.SUPER_ADMIN, Role.TEACHER);
  const tenantId = await getTenantId();

  const exam = await prisma.exam.findFirst({
    where: { id, tenantId },
    include: {
      division: { select: { name: true, course: { select: { name: true } } } },
      subject: { select: { name: true } },
      marks: { select: { studentId: true, score: true } },
    },
  });
  if (!exam) notFound();
  if (session.user.role !== Role.SUPER_ADMIN && !(await teachesClass(tenantId, session.user.id, exam.divisionId, exam.subjectId))) {
    notFound();
  }

  const students = await prisma.student.findMany({
    where: { tenantId, divisionId: exam.divisionId, ...ENROLLED_STUDENT_WHERE },
    select: { id: true, name: true, enrollmentNumber: true },
    orderBy: { name: "asc" },
  });

  const existing = Object.fromEntries(exam.marks.map((m) => [m.studentId, Number(m.score)]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Exams & marks"
        title={exam.name}
        description={`${exam.division.course.name} · ${exam.division.name} · ${exam.subject.name} · Max ${exam.maxMarks}`}
      />

      {students.length === 0 ? (
        <EmptyState icon={Users} title="No active students in this division" />
      ) : (
        <MarksRoster examId={exam.id} maxMarks={exam.maxMarks} students={students} existing={existing} />
      )}
    </div>
  );
}
