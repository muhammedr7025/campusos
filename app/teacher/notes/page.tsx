import { BookOpen } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { SubjectNoteFormDialog } from "@/components/teacher/subject-note-form-dialog";
import { DeleteNoteButton } from "@/components/teacher/delete-note-button";

export default async function TeacherNotesPage() {
  const session = await requireRole(Role.SUPER_ADMIN, Role.TEACHER);
  const tenantId = await getTenantId();

  const myTimetable = await prisma.timetable.findMany({
    where: { tenantId, teacherId: session.user.id },
    include: { division: { select: { courseId: true } } },
  });
  const myCourseIds = session.user.role === Role.SUPER_ADMIN
    ? undefined
    : [...new Set(myTimetable.map((t) => t.division.courseId))];

  const [notes, courses, subjects] = await Promise.all([
    prisma.subjectNote.findMany({
      where: { tenantId, ...(myCourseIds ? { courseId: { in: myCourseIds } } : {}) },
      include: { course: { select: { name: true } }, subject: { select: { name: true } }, author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({
      where: { tenantId, ...(myCourseIds ? { id: { in: myCourseIds } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.subject.findMany({
      where: { tenantId, ...(myCourseIds ? { courseId: { in: myCourseIds } } : {}) },
      select: { id: true, name: true, courseId: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Academics"
        title="Subject notes"
        description="Published per subject for a whole course. Fee-clear students only."
        actions={<SubjectNoteFormDialog courses={courses} subjects={subjects} />}
      />

      {notes.length === 0 ? (
        <EmptyState icon={BookOpen} title="No notes published yet" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-muted-foreground text-sm">{n.course.name} · {n.subject.name}</p>
                  {n.text && <p className="text-muted-foreground mt-1 text-sm">{n.text}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary">{n.kind.replace("_", " ")}</Badge>
                    {n.pages != null && <span className="text-muted-foreground text-xs">{n.pages} pp</span>}
                  </div>
                </div>
                <DeleteNoteButton id={n.id} title={n.title} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
