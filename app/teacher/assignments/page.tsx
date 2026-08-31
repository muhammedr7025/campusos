import Link from "next/link";
import { FileText } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { AssignmentFormDialog } from "@/components/teacher/assignment-form-dialog";

export default async function TeacherAssignmentsPage() {
  const session = await requireRole(Role.SUPER_ADMIN, Role.TEACHER);
  const tenantId = await getTenantId();

  const [assignments, divisions, subjects] = await Promise.all([
    prisma.assignment.findMany({
      where: { tenantId, teacherId: session.user.id },
      include: { division: { include: { course: true } }, subject: true, submissions: { select: { status: true } } },
      orderBy: { dueDate: "desc" },
    }),
    prisma.division.findMany({ where: { tenantId }, select: { id: true, name: true, courseId: true } }),
    prisma.subject.findMany({ where: { tenantId }, select: { id: true, name: true, courseId: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground text-sm">Create, track, and grade submissions.</p>
        </div>
        <AssignmentFormDialog divisions={divisions} subjects={subjects} />
      </div>

      {assignments.length === 0 ? (
        <EmptyState icon={FileText} title="No assignments yet" description="Post your first assignment to a division." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => {
            const graded = a.submissions.filter((s) => s.status === "GRADED").length;
            const submitted = a.submissions.filter((s) => s.status === "SUBMITTED" || s.status === "LATE" || s.status === "GRADED").length;
            return (
              <Link key={a.id} href={`/teacher/assignments/${a.id}/submissions`}>
                <Card className="hover:border-primary/50 h-full transition-colors">
                  <CardContent className="flex flex-col gap-2 p-4">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-muted-foreground text-sm">{a.division.course.name} · {a.division.name} · {a.subject.name}</p>
                    <p className="text-muted-foreground text-xs">Due {a.dueDate.toLocaleDateString()}</p>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{submitted}/{a.submissions.length} submitted</Badge>
                      <Badge variant="outline">{graded} graded</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
