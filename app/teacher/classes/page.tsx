import Link from "next/link";
import { Layers } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { percentByKey } from "@/lib/academics/attendance";
import { DAY_LABELS } from "@/lib/validators/timetable";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** The divisions this teacher actually stands in front of, one card each. */
export default async function MyClassesPage() {
  const session = await requireRole(Role.SUPER_ADMIN, Role.TEACHER);
  const tenantId = await getTenantId();
  const isAdmin = session.user.role === Role.SUPER_ADMIN;

  const slots = await prisma.timetable.findMany({
    where: { tenantId, ...(isAdmin ? {} : { teacherId: session.user.id }) },
    include: {
      subject: { select: { name: true } },
      division: {
        select: {
          id: true,
          name: true,
          course: { select: { name: true } },
          _count: { select: { students: { where: ENROLLED_STUDENT_WHERE } } },
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const divisionIds = [...new Set(slots.map((s) => s.divisionId))];
  const attendance = await prisma.attendance.groupBy({
    by: ["divisionId", "status"],
    where: { tenantId, divisionId: { in: divisionIds } },
    _count: { _all: true },
  });
  const attendanceByDivision = percentByKey(attendance, "divisionId");

  const classes = divisionIds.map((id) => {
    const mine = slots.filter((s) => s.divisionId === id);
    const division = mine[0].division;
    return {
      id,
      name: division.name,
      courseName: division.course.name,
      students: division._count.students,
      subjects: [...new Set(mine.map((s) => s.subject.name))],
      slots: mine,
      attendancePct: attendanceByDivision.get(id) ?? null,
    };
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="Class" title="My classes" description="Every division you teach, with this week's slots." />

      {classes.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No classes assigned"
          description="Once Admin schedules your timetable, your divisions appear here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-muted-foreground text-sm">{c.courseName}</p>
                  </div>
                  {c.attendancePct != null && (
                    <Badge variant={c.attendancePct >= 75 ? "secondary" : "destructive"}>{c.attendancePct}%</Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {c.students} student{c.students === 1 ? "" : "s"} · {c.subjects.join(", ")}
                </p>
                <div className="flex flex-col gap-0.5">
                  {c.slots.slice(0, 3).map((s) => (
                    <p key={s.id} className="text-muted-foreground text-xs tabular-nums">
                      {DAY_LABELS[s.dayOfWeek]} {s.startTime}–{s.endTime}
                      {s.room ? ` · ${s.room}` : ""}
                    </p>
                  ))}
                  {c.slots.length > 3 && (
                    <p className="text-muted-foreground text-xs">+{c.slots.length - 3} more slots</p>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`/teacher/attendance/${c.id}?subject=${c.slots[0].subjectId}&date=${today}`}>
                      Take attendance
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/teacher/students">Students</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
