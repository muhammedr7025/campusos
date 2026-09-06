import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { DAY_LABELS } from "@/lib/validators/timetable";

export default async function TeacherAttendancePage() {
  const session = await requireRole(Role.SUPER_ADMIN, Role.TEACHER);
  const tenantId = await getTenantId();

  const entries = await prisma.timetable.findMany({
    where: { tenantId, ...(session.user.role === Role.SUPER_ADMIN ? {} : { teacherId: session.user.id }) },
    include: { division: { include: { course: true } }, subject: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const today = new Date().toISOString().slice(0, 10);
  const todayDow = new Date().getDay();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="Class" title="Mark attendance" description="Pick a class to mark attendance for." />

      {entries.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No classes assigned" description="Once Admin schedules your timetable, your classes will show up here." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <Card key={entry.id} className={entry.dayOfWeek === todayDow ? "border-primary/40" : undefined}>
              <CardContent className="flex flex-col gap-2 p-4">
                <p className="font-medium">{entry.division.course.name} · {entry.division.name}</p>
                <p className="text-muted-foreground text-sm">{entry.subject.name}</p>
                <p className="text-muted-foreground text-xs">{DAY_LABELS[entry.dayOfWeek]} · {entry.startTime}–{entry.endTime}</p>
                <Button asChild size="sm" className="mt-1 w-fit">
                  <Link href={`/teacher/attendance/${entry.divisionId}?subject=${entry.subjectId}&date=${today}`}>
                    Take attendance
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
