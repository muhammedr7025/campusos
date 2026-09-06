import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { attendancePercent } from "@/lib/academics/attendance";
import { getCurrentFeePlanForStudent } from "@/lib/fees/balance";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/layout/stat-card";
import { KycChecklist } from "@/components/admissions/kyc-checklist";
import { EditStudentDialog } from "@/components/admissions/edit-student-dialog";
import { ReassignDivisionDialog } from "@/components/admissions/reassign-division-dialog";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(Role.SUPER_ADMIN, Role.ADMISSION_OFFICER);
  const tenantId = await getTenantId();
  const { id } = await params;

  const student = await prisma.student.findFirst({
    where: { id, tenantId },
    include: {
      course: true,
      division: true,
      kycDocuments: { orderBy: { docType: "asc" } },
      guardians: { include: { guardian: true } },
    },
  });

  if (!student) notFound();

  const [divisions, attendance, feePlan, marks] = await Promise.all([
    prisma.division.findMany({
      where: { tenantId, courseId: student.courseId },
      include: { _count: { select: { students: { where: ENROLLED_STUDENT_WHERE } } } },
      orderBy: { name: "asc" },
    }),
    prisma.attendance.findMany({ where: { tenantId, studentId: student.id }, select: { status: true } }),
    getCurrentFeePlanForStudent(tenantId, student.id),
    prisma.mark.findMany({
      where: { tenantId, studentId: student.id },
      include: { exam: { select: { name: true, maxMarks: true, date: true, subject: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const attendancePct = attendancePercent(attendance);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/admissions/students" className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Back to students
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl">{student.name}</CardTitle>
            <p className="text-muted-foreground text-sm">{student.enrollmentNumber} · {student.course.name} · {student.division?.name ?? "No division"}</p>
          </div>
          <Badge variant={student.status === "ACTIVE" ? "default" : "secondary"}>{student.status}</Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">Phone: </span>{student.phone ?? "—"}</div>
          <div><span className="text-muted-foreground">Email: </span>{student.email ?? "—"}</div>
          <div><span className="text-muted-foreground">Date of birth: </span>{student.dob ? student.dob.toLocaleDateString() : "—"}</div>
          <div><span className="text-muted-foreground">Address: </span>{student.address ?? "—"}</div>
          {student.guardians.map((sg) => (
            <div key={sg.id}><span className="text-muted-foreground">Guardian: </span>{sg.guardian.name} ({sg.guardian.phone})</div>
          ))}
        </CardContent>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          <EditStudentDialog
            student={{
              id: student.id,
              name: student.name,
              phone: student.phone,
              email: student.email,
              dob: student.dob ? student.dob.toISOString().slice(0, 10) : null,
              address: student.address,
            }}
          />
          <ReassignDivisionDialog
            studentId={student.id}
            currentDivisionId={student.divisionId}
            divisions={divisions.map((d) => ({ id: d.id, name: d.name, studentCount: d._count.students, capacity: d.capacity }))}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Attendance"
          value={attendancePct != null ? `${attendancePct}%` : "—"}
          sub={attendance.length > 0 ? `${attendance.length} sessions marked` : "Nothing marked yet"}
          progress={attendancePct ?? undefined}
        />
        <StatCard
          label="Fees"
          value={feePlan ? `₹${feePlan.balance.toLocaleString("en-IN")}` : "—"}
          sub={feePlan ? `outstanding of ₹${feePlan.total.toLocaleString("en-IN")}` : "No fee plan"}
          progress={feePlan && feePlan.total > 0 ? Math.round((feePlan.paid / feePlan.total) * 100) : undefined}
        />
        <StatCard
          label="Test average"
          value={marks.length > 0 ? `${Math.round(marks.reduce((sum, m) => sum + (Number(m.score) / m.exam.maxMarks) * 100, 0) / marks.length)}%` : "—"}
          sub={marks.length > 0 ? `across ${marks.length} exam${marks.length === 1 ? "" : "s"}` : "No results yet"}
        />
      </div>

      {marks.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Recent results</h2>
          <div className="flex flex-col gap-2">
            {marks.map((m) => (
              <Card key={m.id}>
                <CardContent className="flex items-center justify-between gap-3 p-3.5 text-sm">
                  <div>
                    <p className="font-medium">{m.exam.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {m.exam.subject.name} · {m.exam.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <Badge variant={Number(m.score) / m.exam.maxMarks >= 0.5 ? "secondary" : "destructive"}>
                    {Number(m.score)}/{m.exam.maxMarks}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">KYC checklist</h2>
        <KycChecklist
          studentId={student.id}
          docs={student.kycDocuments}
          canVerify={session.user.role === Role.SUPER_ADMIN || session.user.role === Role.ADMISSION_OFFICER}
        />
      </div>
    </div>
  );
}
