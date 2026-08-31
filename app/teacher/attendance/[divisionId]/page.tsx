import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { AttendanceRoster } from "@/components/teacher/attendance-roster";
import type { AttendanceStatus } from "@/generated/prisma/client";

export default async function AttendanceRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ divisionId: string }>;
  searchParams: Promise<{ subject?: string; date?: string }>;
}) {
  await requireRole(Role.SUPER_ADMIN, Role.TEACHER);
  const tenantId = await getTenantId();
  const { divisionId } = await params;
  const { subject, date } = await searchParams;

  if (!subject || !date) notFound();

  const division = await prisma.division.findFirst({
    where: { id: divisionId, tenantId },
    include: { course: true },
  });
  const subjectRecord = await prisma.subject.findFirst({ where: { id: subject, tenantId } });
  if (!division || !subjectRecord) notFound();

  const students = await prisma.student.findMany({
    where: { tenantId, divisionId, status: "ACTIVE" },
    select: { id: true, name: true, enrollmentNumber: true },
    orderBy: { name: "asc" },
  });

  const existingRecords = await prisma.attendance.findMany({
    where: { tenantId, divisionId, subjectId: subject, date: new Date(`${date}T00:00:00`) },
    select: { studentId: true, status: true },
  });
  const existing = existingRecords.reduce<Record<string, AttendanceStatus>>((acc, r) => {
    acc[r.studentId] = r.status;
    return acc;
  }, {});

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link href="/teacher/attendance" className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{division.course.name} · {division.name}</h1>
        <p className="text-muted-foreground text-sm">{subjectRecord.name} · {new Date(`${date}T00:00:00`).toLocaleDateString()}</p>
      </div>
      {students.length === 0 ? (
        <p className="text-muted-foreground text-sm">No active students in this division yet.</p>
      ) : (
        <AttendanceRoster divisionId={divisionId} subjectId={subject} date={date} students={students} existing={existing} />
      )}
    </div>
  );
}
