import { Contact, Users } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getPortalStudents, getActiveStudentId } from "@/lib/portal/context";
import { attendancePercent } from "@/lib/academics/attendance";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { ChildSwitcher } from "@/components/portal/child-switcher";

/**
 * Who teaches this child, and how they're doing in that subject — the two
 * things a parent wants in hand before starting a conversation.
 */
export default async function TeacherContactsPage() {
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
          include: {
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, name: true, email: true, phone: true } },
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        })
      : Promise.resolve([]),
    prisma.attendance.findMany({
      where: { tenantId, studentId: activeStudentId },
      select: { subjectId: true, status: true },
    }),
  ]);

  // One card per teacher+subject pairing, not per weekly slot.
  const seen = new Map<string, (typeof slots)[number]>();
  for (const slot of slots) {
    const key = `${slot.teacher.id}:${slot.subject.id}`;
    if (!seen.has(key)) seen.set(key, slot);
  }
  const contacts = [...seen.values()];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="School"
        title="Teacher contacts"
        description="The faculty teaching this division, with how your child is doing in each subject."
        actions={<ChildSwitcher students={students} activeStudentId={activeStudentId} />}
      />

      {contacts.length === 0 ? (
        <EmptyState
          icon={Contact}
          title="No faculty assigned yet"
          description="Teachers appear here once the institute publishes this division's timetable."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((slot) => {
            const pct = attendancePercent(attendance.filter((a) => a.subjectId === slot.subject.id));
            return (
              <Card key={`${slot.teacher.id}-${slot.subject.id}`}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{slot.teacher.name}</p>
                      <p className="text-muted-foreground text-sm">{slot.subject.name}</p>
                    </div>
                    {pct != null && (
                      <Badge variant={pct >= 75 ? "secondary" : "destructive"}>{pct}%</Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 text-sm">
                    <a href={`mailto:${slot.teacher.email}`} className="hover:underline">
                      {slot.teacher.email}
                    </a>
                    {slot.teacher.phone && (
                      <a href={`tel:${slot.teacher.phone}`} className="text-muted-foreground hover:underline">
                        {slot.teacher.phone}
                      </a>
                    )}
                  </div>
                  {pct != null && pct < 75 && (
                    <p className="text-destructive text-xs">Below the 75% requirement in this subject.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
