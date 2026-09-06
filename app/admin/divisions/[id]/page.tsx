import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { attendancePercent } from "@/lib/academics/attendance";
import { getFeeSummaryForTenant } from "@/lib/fees/balance";
import { DivisionFormDialog } from "@/components/admin/divisions/division-form-dialog";

export default async function DivisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();
  const { id } = await params;

  const division = await prisma.division.findFirst({
    where: { id, tenantId },
    include: {
      course: true,
      // Alumni don't hold a seat, so they're not part of the roster or the count.
      students: { where: ENROLLED_STUDENT_WHERE, orderBy: { name: "asc" } },
    },
  });
  if (!division) notFound();

  const [courses, attendance, slots, plans] = await Promise.all([
    prisma.course.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.attendance.findMany({ where: { tenantId, divisionId: division.id }, select: { status: true } }),
    prisma.timetable.findMany({
      where: { tenantId, divisionId: division.id },
      include: { subject: { select: { name: true } }, teacher: { select: { name: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    getFeeSummaryForTenant(tenantId, { divisionId: division.id }),
  ]);

  const attendancePct = attendancePercent(attendance);
  const billed = plans.reduce((sum, p) => sum + p.total, 0);
  const collected = plans.reduce((sum, p) => sum + p.paid, 0);
  const collectedPct = billed > 0 ? Math.round((collected / billed) * 100) : null;

  // Faculty is whoever the timetable puts in front of this division.
  const faculty = [...new Map(slots.map((s) => [s.teacher.name, s])).values()];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/admin/divisions" className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Back to divisions
      </Link>

      <PageHeader
        crumb="Academics"
        title={division.name}
        description={`${division.course.name} · ${division.students.length}${division.capacity != null ? ` / ${division.capacity}` : ""} students`}
        actions={
          <DivisionFormDialog
            courses={courses}
            division={{ id: division.id, courseId: division.courseId, name: division.name, capacity: division.capacity }}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Seats filled"
          value={division.capacity != null ? `${division.students.length} / ${division.capacity}` : division.students.length}
          sub={division.capacity != null ? `${Math.max(0, division.capacity - division.students.length)} left` : "No capacity set"}
          progress={division.capacity ? Math.round((division.students.length / division.capacity) * 100) : undefined}
        />
        <StatCard
          label="Avg attendance"
          value={attendancePct != null ? `${attendancePct}%` : "—"}
          sub={attendance.length > 0 ? `${attendance.length} sessions marked` : "Nothing marked yet"}
          progress={attendancePct ?? undefined}
        />
        <StatCard
          label="Fees collected"
          value={collectedPct != null ? `${collectedPct}%` : "—"}
          sub={billed > 0 ? `₹${collected.toLocaleString("en-IN")} of ₹${billed.toLocaleString("en-IN")}` : "No fee plans"}
          progress={collectedPct ?? undefined}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Faculty</h2>
        {faculty.length === 0 ? (
          <p className="text-muted-foreground text-sm">No timetable slots scheduled for this division yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {faculty.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between gap-3 p-3.5 text-sm">
                  <div>
                    <p className="font-medium">{s.teacher.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {[...new Set(slots.filter((x) => x.teacher.name === s.teacher.name).map((x) => x.subject.name))].join(", ")}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {slots.filter((x) => x.teacher.name === s.teacher.name).length} slot
                    {slots.filter((x) => x.teacher.name === s.teacher.name).length === 1 ? "" : "s"}/week
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Enrolled students</h2>
        {division.students.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No students enrolled yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {division.students.map((student) => (
              <Link key={student.id} href={`/admissions/students/${student.id}`}>
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-muted-foreground text-sm">{student.enrollmentNumber}</p>
                    </div>
                    <Badge variant={student.status === "ACTIVE" ? "default" : "secondary"}>{student.status}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
