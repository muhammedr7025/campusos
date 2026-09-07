import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
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
    where: { tenantId, divisionId, ...ENROLLED_STUDENT_WHERE },
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

      <div className="rounded-2xl bg-[#10151A] p-5 text-[#F5F3EE]">
        <div className="text-[11.5px] font-semibold tracking-[.12em] text-[#C9821A] uppercase">
          Marking · {new Date(`${date}T00:00:00`).toLocaleDateString()}
        </div>
        <div className="font-heading mt-1 text-[25px] leading-tight">{subjectRecord.name}</div>
        <div className="mt-1 text-[13px] text-[#F5F3EE]/60">
          {division.course.name} · {division.name} · {students.length} student{students.length === 1 ? "" : "s"}
        </div>
      </div>

      {students.length === 0 ? (
        <p className="text-muted-foreground text-sm">No active students in this division yet.</p>
      ) : (
        <AttendanceRoster divisionId={divisionId} subjectId={subject} date={date} students={students} existing={existing} />
      )}
    </div>
  );
}
