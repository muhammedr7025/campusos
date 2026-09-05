import { CalendarDays } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { TimetableFormDialog } from "@/components/admin/timetable/timetable-form-dialog";
import { DeleteSlotButton } from "@/components/admin/timetable/delete-slot-button";
import { DAY_LABELS } from "@/lib/validators/timetable";

export default async function AdminTimetablePage() {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();

  const [entries, divisions, subjects, teachers] = await Promise.all([
    prisma.timetable.findMany({
      where: { tenantId },
      include: { division: { include: { course: true } }, subject: true, teacher: { select: { name: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.division.findMany({ where: { tenantId }, select: { id: true, name: true, courseId: true } }),
    prisma.subject.findMany({ where: { tenantId }, select: { id: true, name: true, courseId: true } }),
    prisma.user.findMany({ where: { tenantId, role: Role.TEACHER }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Academics"
        title="Timetable"
        description="Weekly schedule across all divisions."
        actions={<TimetableFormDialog divisions={divisions} subjects={subjects} teachers={teachers} />}
      />

      {entries.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No timetable slots yet" description="Add the first class slot." />
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">{DAY_LABELS[entry.dayOfWeek]}</Badge>
                  <span className="font-medium">{entry.startTime}–{entry.endTime}</span>
                  <span>{entry.division.course.name} · {entry.division.name}</span>
                  <span className="text-muted-foreground">{entry.subject.name}</span>
                  <span className="text-muted-foreground">{entry.teacher.name}</span>
                  {entry.room && <span className="text-muted-foreground">Room {entry.room}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <TimetableFormDialog
                    divisions={divisions}
                    subjects={subjects}
                    teachers={teachers}
                    entry={{
                      id: entry.id,
                      divisionId: entry.divisionId,
                      subjectId: entry.subjectId,
                      teacherId: entry.teacherId,
                      dayOfWeek: entry.dayOfWeek,
                      startTime: entry.startTime,
                      endTime: entry.endTime,
                      room: entry.room ?? "",
                    }}
                  />
                  <DeleteSlotButton id={entry.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
