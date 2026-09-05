import Link from "next/link";
import { FileText, Users } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getPortalStudents, getActiveStudentId } from "@/lib/portal/context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ChildSwitcher } from "@/components/portal/child-switcher";
import type { SubmissionStatus } from "@/generated/prisma/client";

const STATUS_VARIANT: Record<SubmissionStatus, "default" | "secondary" | "outline" | "destructive" | "warning"> = {
  MISSING: "destructive",
  SUBMITTED: "outline",
  LATE: "warning",
  GRADED: "default",
};

export default async function PortalAssignmentsPage() {
  const session = await requireRole(Role.STUDENT, Role.PARENT);
  const tenantId = await getTenantId();

  const students = await getPortalStudents(tenantId, session.user.id, session.user.role);
  const activeStudentId = await getActiveStudentId(students);
  if (!activeStudentId) {
    return <EmptyState icon={Users} title="No student profile linked yet" />;
  }

  const submissions = await prisma.submission.findMany({
    where: { tenantId, studentId: activeStudentId },
    include: { assignment: { include: { subject: true } } },
    orderBy: { assignment: { dueDate: "desc" } },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Student"
        title="Assignments"
        description="Due dates, submissions, and grades."
        actions={<ChildSwitcher students={students} activeStudentId={activeStudentId} />}
      />

      {submissions.length === 0 ? (
        <EmptyState icon={FileText} title="No assignments yet" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {submissions.map((s) => (
            <Link key={s.id} href={s.status === "MISSING" || s.status === "LATE" ? `/portal/assignments/${s.assignment.id}/submit` : "#"}>
              <Card className={s.status !== "GRADED" ? "hover:border-primary/50 transition-colors" : undefined}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <p className="font-medium">{s.assignment.title}</p>
                  <p className="text-muted-foreground text-sm">{s.assignment.subject.name}</p>
                  <p className="text-muted-foreground text-xs">Due {s.assignment.dueDate.toLocaleDateString()}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
                    {s.grade && <Badge variant="outline">{s.grade}</Badge>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
