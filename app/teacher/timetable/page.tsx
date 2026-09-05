import { CalendarDays } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { DAY_LABELS } from "@/lib/validators/timetable";

export default async function TeacherTimetablePage() {
  const session = await requireRole(Role.SUPER_ADMIN, Role.TEACHER);
  const tenantId = await getTenantId();

  const entries = await prisma.timetable.findMany({
    where: { tenantId, teacherId: session.user.id },
    include: { division: { include: { course: true } }, subject: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="Class" title="My timetable" description="Your weekly teaching schedule." />

      {entries.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No classes scheduled yet" description="Once Admin schedules your classes, they'll show up here." />
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
