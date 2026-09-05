import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradeSubmissionDialog } from "@/components/teacher/grade-submission-dialog";
import { EditAssignmentDialog } from "@/components/teacher/edit-assignment-dialog";
import { DeleteAssignmentButton } from "@/components/teacher/delete-assignment-button";
import type { SubmissionStatus } from "@/generated/prisma/client";

const STATUS_VARIANT: Record<SubmissionStatus, "default" | "secondary" | "outline" | "destructive"> = {
  MISSING: "destructive",
  SUBMITTED: "outline",
  LATE: "secondary",
  GRADED: "default",
};

export default async function AssignmentSubmissionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(Role.SUPER_ADMIN, Role.TEACHER);
  const tenantId = await getTenantId();
  const { id } = await params;

  const assignment = await prisma.assignment.findFirst({
    where: { id, tenantId },
    include: {
      division: { include: { course: true } },
      subject: true,
      submissions: { include: { student: { select: { id: true, name: true, enrollmentNumber: true } } }, orderBy: { student: { name: "asc" } } },
    },
  });
  if (!assignment) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/teacher/assignments" className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Back to assignments
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl">{assignment.title}</h1>
          <p className="text-muted-foreground text-sm">
            {assignment.division.course.name} · {assignment.division.name} · {assignment.subject.name} · Due {assignment.dueDate.toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <EditAssignmentDialog
            assignmentId={assignment.id}
            title={assignment.title}
            description={assignment.description}
            dueDate={assignment.dueDate.toISOString().slice(0, 10)}
          />
          <DeleteAssignmentButton assignmentId={assignment.id} title={assignment.title} redirectTo="/teacher/assignments" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {assignment.submissions.map((submission) => (
          <Card key={submission.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{submission.student.name}</p>
                <p className="text-muted-foreground text-xs">{submission.student.enrollmentNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[submission.status]}>
                  {submission.status}
                  {submission.grade ? ` · ${submission.grade}` : ""}
                </Badge>
                {submission.status !== "MISSING" && (
                  <GradeSubmissionDialog
                    submissionId={submission.id}
                    studentName={submission.student.name}
                    submissionText={submission.text}
                    fileUrl={submission.fileUrl}
                    initialGrade={submission.grade}
                    initialFeedback={submission.feedback}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
