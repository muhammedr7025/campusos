import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { Role } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { DAY_LABELS } from "@/lib/validators/timetable";
import { AttendanceReportTable, type AttendanceReportRow } from "@/components/teacher/attendance-report-table";

export default async function AttendanceReportPage() {
  const session = await requireRole(Role.SUPER_ADMIN, Role.TEACHER);
  const tenantId = await getTenantId();

  const isAdmin = session.user.role === Role.SUPER_ADMIN;
  const slots = await prisma.timetable.findMany({
    where: { tenantId, ...(isAdmin ? {} : { teacherId: session.user.id }) },
    include: { division: { select: { name: true, course: { select: { name: true } } } }, subject: { select: { name: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const divisionIds = [...new Set(slots.map((t) => t.divisionId))];
  const subjectIds = [...new Set(slots.map((t) => t.subjectId))];

  const [students, attendance] = await Promise.all([
    prisma.student.findMany({
      where: { tenantId, ...ENROLLED_STUDENT_WHERE, divisionId: { in: divisionIds } },
      select: { id: true, divisionId: true },
    }),
    prisma.attendance.findMany({
      where: { tenantId, divisionId: { in: divisionIds }, subjectId: { in: subjectIds } },
      select: { studentId: true, divisionId: true, subjectId: true, status: true, date: true },
    }),
  ]);

  const rows: AttendanceReportRow[] = slots.map((slot) => {
    const roster = students.filter((s) => s.divisionId === slot.divisionId);
    const rosterIds = new Set(roster.map((s) => s.id));
    const records = attendance.filter((a) => a.divisionId === slot.divisionId && a.subjectId === slot.subjectId && rosterIds.has(a.studentId));

    const perStudent = new Map<string, { present: number; total: number }>();
    const sessionDates = new Set<string>();
    for (const r of records) {
      sessionDates.add(r.date.toISOString().slice(0, 10));
      const entry = perStudent.get(r.studentId) ?? { present: 0, total: 0 };
      entry.total += 1;
      if (r.status === "PRESENT" || r.status === "LATE") entry.present += 1;
      perStudent.set(r.studentId, entry);
    }

    const perStudentPct = roster.map((s) => {
      const entry = perStudent.get(s.id);
      return entry && entry.total > 0 ? (entry.present / entry.total) * 100 : null;
    });
    const withData = perStudentPct.filter((p): p is number => p != null);
    const avgAttendance = withData.length > 0 ? Math.round(withData.reduce((a, b) => a + b, 0) / withData.length) : null;
    const below75 = withData.filter((p) => p < 75).length;

    return {
      id: slot.id,
      divisionLabel: `${slot.division.course.name} · ${slot.division.name}`,
      dayTime: `${DAY_LABELS[slot.dayOfWeek]} · ${slot.startTime}–${slot.endTime}`,
      subjectName: slot.subject.name,
      studentCount: roster.length,
      avgAttendance,
      below75,
      sessions: sessionDates.size,
      divisionId: slot.divisionId,
      subjectId: slot.subjectId,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Class"
        title="Attendance report"
        description="Live figures, recomputed the moment you submit a class."
      />
      <AttendanceReportTable rows={rows} />
    </div>
  );
}
