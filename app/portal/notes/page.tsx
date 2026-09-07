import { BookOpen, Lock, Paperclip, Users } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getPortalStudents, getActiveStudentId } from "@/lib/portal/context";
import { getCurrentFeePlanForStudent } from "@/lib/fees/balance";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { ChildSwitcher } from "@/components/portal/child-switcher";

export default async function PortalNotesPage() {
  const session = await requireRole(Role.STUDENT, Role.PARENT);
  const tenantId = await getTenantId();

  const students = await getPortalStudents(tenantId, session.user.id, session.user.role);
  const activeStudentId = await getActiveStudentId(students);
  if (!activeStudentId) {
    return <EmptyState icon={Users} title="No student profile linked yet" />;
  }
  const activeStudent = students.find((s) => s.id === activeStudentId)!;

  const [notes, feeDetail] = await Promise.all([
    prisma.subjectNote.findMany({
      where: { tenantId, courseId: activeStudent.courseId },
      include: { subject: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getCurrentFeePlanForStudent(tenantId, activeStudentId),
  ]);

  // Access lock is a student-specific policy — a parent can always view.
  const locked = session.user.role === Role.STUDENT && !!feeDetail && feeDetail.balance > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Academics"
        title="Subject notes"
        description={locked ? `Locked while ₹${feeDetail!.balance.toLocaleString("en-IN")} is outstanding.` : "All notes for your course, subject by subject."}
        actions={<ChildSwitcher students={students} activeStudentId={activeStudentId} />}
      />

      {notes.length === 0 ? (
        <EmptyState icon={BookOpen} title="No notes published yet" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <p className="font-medium">{n.title}</p>
                <p className="text-muted-foreground text-sm">{n.subject.name}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{n.kind.replace("_", " ")}</Badge>
                  {n.pages != null && <span className="text-muted-foreground text-xs">{n.pages} pp</span>}
                  {locked ? (
                    <Badge variant="destructive" className="gap-1">
                      <Lock className="size-3" /> Locked
                    </Badge>
                  ) : (
                    n.fileUrl && (
                      <a
                        href={n.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                      >
                        <Paperclip className="size-3" /> Open attachment
                      </a>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
