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
import { FilterPills } from "@/components/layout/filter-pills";

export default async function AdminTimetablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();
  const params = await searchParams;

  const [allDivisions, subjects, teachers] = await Promise.all([
    prisma.division.findMany({
      where: { tenantId },
      select: { id: true, name: true, courseId: true, course: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.subject.findMany({ where: { tenantId }, select: { id: true, name: true, courseId: true } }),
    prisma.user.findMany({ where: { tenantId, role: Role.TEACHER }, select: { id: true, name: true } }),
  ]);

  // Division names can repeat across courses ("Morning A"), so filter on the
  // id and label the pill with the course it belongs to.
  const divisionOptions = allDivisions.map((d) => ({ id: d.id, label: `${d.course.name} · ${d.name}` }));
  const activeDivision = divisionOptions.find((d) => d.id === params.division)?.id;
  const dayOptions = ["All", ...DAY_LABELS];
  const activeDay = dayOptions.includes(params.day ?? "") ? params.day! : "All";
  const activeDayIndex = DAY_LABELS.indexOf(activeDay);

  const entries = await prisma.timetable.findMany({
    where: {
      tenantId,
      ...(activeDivision ? { divisionId: activeDivision } : {}),
      ...(activeDayIndex >= 0 ? { dayOfWeek: activeDayIndex } : {}),
    },
    include: { division: { include: { course: true } }, subject: true, teacher: { select: { name: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const divisions = allDivisions.map((d) => ({ id: d.id, name: d.name, courseId: d.courseId }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Academics"
        title="Timetable"
        description="Weekly schedule across all divisions."
        actions={<TimetableFormDialog divisions={divisions} subjects={subjects} teachers={teachers} />}
      />

      <div className="flex flex-col gap-2">
        <FilterPills options={dayOptions} active={activeDay} paramKey="day" />
        {divisionOptions.length > 0 && (
          <FilterPills
            options={[{ value: "All", label: "All divisions" }, ...divisionOptions.map((d) => ({ value: d.id, label: d.label }))]}
            active={activeDivision ?? "All"}
            paramKey="division"
          />
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={activeDivision || activeDayIndex >= 0 ? "No slots match these filters" : "No timetable slots yet"}
          description={activeDivision || activeDayIndex >= 0 ? undefined : "Add the first class slot."}
        />
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
