import { CalendarDays, Users } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getPortalStudents, getActiveStudentId } from "@/lib/portal/context";
import { attendancePercent } from "@/lib/academics/attendance";
import { DAY_LABELS } from "@/lib/validators/timetable";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { ChildSwitcher } from "@/components/portal/child-switcher";

/**
 * The division's weekly schedule, with the viewer's own attendance per
 * subject alongside each slot — the two questions ("when is it" and "am I
 * short") are always asked together.
 */
export default async function PortalTimetablePage() {
  const session = await requireRole(Role.STUDENT, Role.PARENT);
  const tenantId = await getTenantId();

  const students = await getPortalStudents(tenantId, session.user.id, session.user.role);
  const activeStudentId = await getActiveStudentId(students);
  if (!activeStudentId) {
    return <EmptyState icon={Users} title="No student profile linked yet" />;
  }
  const activeStudent = students.find((s) => s.id === activeStudentId)!;

  const [slots, attendance] = await Promise.all([
    activeStudent.divisionId
      ? prisma.timetable.findMany({
          where: { tenantId, divisionId: activeStudent.divisionId },
          include: { subject: { select: { id: true, name: true } }, teacher: { select: { name: true } } },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        })
      : Promise.resolve([]),
    prisma.attendance.findMany({
      where: { tenantId, studentId: activeStudentId },
      select: { subjectId: true, status: true },
    }),
  ]);

  const byDay = new Map<number, typeof slots>();
  for (const slot of slots) {
    byDay.set(slot.dayOfWeek, [...(byDay.get(slot.dayOfWeek) ?? []), slot]);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Academics"
        title={session.user.role === Role.PARENT ? "Class timetable" : "My timetable"}
        description="Attendance updates the moment a teacher submits a class."
        actions={<ChildSwitcher students={students} activeStudentId={activeStudentId} />}
      />

      {slots.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No timetable published yet"
          description="Once the institute schedules classes for this division, they appear here."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {[...byDay.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([day, daySlots]) => (
              <div key={day} className="flex flex-col gap-2">
                <h2 className="eyebrow">{DAY_LABELS[day]}</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {daySlots.map((slot) => {
                    const pct = attendancePercent(attendance.filter((a) => a.subjectId === slot.subject.id));
                    return (
                      <Card key={slot.id}>
                        <CardContent className="flex flex-col gap-1.5 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium">{slot.subject.name}</p>
                              <p className="text-muted-foreground text-sm tabular-nums">
                                {slot.startTime}–{slot.endTime}
                              </p>
                            </div>
                            {pct != null && (
                              <Badge variant={pct >= 85 ? "secondary" : pct >= 75 ? "warning" : "destructive"}>
                                {pct}%
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {slot.teacher.name}
                            {slot.room ? ` · ${slot.room}` : ""}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
