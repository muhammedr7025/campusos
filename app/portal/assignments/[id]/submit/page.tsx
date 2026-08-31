import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitAssignmentForm } from "@/components/portal/submit-assignment-form";

export default async function SubmitAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(Role.STUDENT);
  const tenantId = await getTenantId();
  const { id } = await params;

  const student = await prisma.student.findFirst({ where: { tenantId, userId: session.user.id } });
  if (!student) notFound();

  const submission = await prisma.submission.findFirst({
    where: { tenantId, assignmentId: id, studentId: student.id },
    include: { assignment: { include: { subject: true } } },
  });
  if (!submission) notFound();

  if (submission.status === "GRADED") redirect("/portal/assignments");

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Link href="/portal/assignments" className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{submission.assignment.title}</CardTitle>
            <Badge variant={new Date() > submission.assignment.dueDate ? "destructive" : "secondary"}>
              Due {submission.assignment.dueDate.toLocaleDateString()}
            </Badge>
          </div>
          <CardDescription>{submission.assignment.subject.name}</CardDescription>
        </CardHeader>
        <CardContent>
          {submission.assignment.description && <p className="text-muted-foreground mb-4 text-sm">{submission.assignment.description}</p>}
          {submission.assignment.attachmentUrl && (
            <a href={submission.assignment.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary mb-4 block text-sm hover:underline">
              View assignment attachment
            </a>
          )}
          <SubmitAssignmentForm submissionId={submission.id} defaultText={submission.text} />
        </CardContent>
      </Card>
    </div>
  );
}
