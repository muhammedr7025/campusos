import { CalendarDays } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { FilterPills } from "@/components/layout/filter-pills";
import { DAY_LABELS } from "@/lib/validators/timetable";

export default async function TeacherTimetablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireRole(Role.SUPER_ADMIN, Role.TEACHER);
  const tenantId = await getTenantId();
  const params = await searchParams;

  // Only the divisions this teacher actually teaches — filtering by a
  // division they never see would be a row of dead pills.
  const mine = { tenantId, ...(session.user.role === Role.SUPER_ADMIN ? {} : { teacherId: session.user.id }) };
  const taught = await prisma.timetable.findMany({
    where: mine,
    select: { divisionId: true, division: { select: { name: true, course: { select: { name: true } } } } },
  });

  const divisionOptions = [...new Map(taught.map((t) => [t.divisionId, t])).values()]
    .map((t) => ({ value: t.divisionId, label: `${t.division.course.name} · ${t.division.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const activeDivision = divisionOptions.find((d) => d.value === params.division)?.value;
  const dayOptions = ["All", ...DAY_LABELS];
  const activeDay = dayOptions.includes(params.day ?? "") ? params.day! : "All";
  const activeDayIndex = DAY_LABELS.indexOf(activeDay);
  const filtered = !!activeDivision || activeDayIndex >= 0;

  const entries = await prisma.timetable.findMany({
    where: {
      ...mine,
      ...(activeDivision ? { divisionId: activeDivision } : {}),
      ...(activeDayIndex >= 0 ? { dayOfWeek: activeDayIndex } : {}),
    },
    include: { division: { include: { course: true } }, subject: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="Class" title="My timetable" description="Your weekly teaching schedule." />

      {divisionOptions.length > 0 && (
        <div className="flex flex-col gap-2">
          <FilterPills options={dayOptions} active={activeDay} paramKey="day" />
          <FilterPills
            options={[{ value: "All", label: "All divisions" }, ...divisionOptions]}
            active={activeDivision ?? "All"}
            paramKey="division"
          />
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={filtered ? "No classes match these filters" : "No classes scheduled yet"}
          description={filtered ? undefined : "Once Admin schedules your classes, they'll show up here."}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <Badge variant="secondary">{DAY_LABELS[entry.dayOfWeek]}</Badge>
                <span className="font-medium">{entry.startTime}–{entry.endTime}</span>
                <span>{entry.division.course.name} · {entry.division.name}</span>
                <span className="text-muted-foreground">{entry.subject.name}</span>
                {entry.room && <span className="text-muted-foreground">Room {entry.room}</span>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
