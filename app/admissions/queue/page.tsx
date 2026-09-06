import Link from "next/link";
import { UserPlus } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { AdmitStudentDialog } from "@/components/admissions/admit-student-dialog";

/**
 * The counselor→admissions handoff. A lead only lands here once its owner has
 * moved it to Ready, so this queue is a decision made upstream rather than
 * admissions guessing which enquiries are warm.
 */
export default async function ConversionQueuePage() {
  await requireRole(Role.SUPER_ADMIN, Role.ADMISSION_OFFICER);
  const tenantId = await getTenantId();

  const [leads, courses] = await Promise.all([
    prisma.lead.findMany({
      where: { tenantId, status: "READY" },
      include: {
        interestedCourse: { select: { name: true } },
        assignedCounselor: { select: { name: true } },
        _count: { select: { followUps: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.course.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        divisions: {
          select: { id: true, name: true, capacity: true, _count: { select: { students: { where: ENROLLED_STUDENT_WHERE } } } },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Admissions"
        title="Conversion queue"
        description="Converting keeps the same person record, so the lead's history follows the student. A walk-in with no enquiry uses direct admission instead."
        actions={
          <AdmitStudentDialog
            courses={courses.map((c) => ({
              id: c.id,
              name: c.name,
              divisions: c.divisions.map((d) => ({
                id: d.id,
                name: d.name,
                capacity: d.capacity,
                studentCount: d._count.students,
              })),
            }))}
          />
        }
      />

      {leads.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Nothing waiting to convert"
          description="Leads appear here once a counselor marks them Ready. You can still admit a walk-in directly."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <Card key={lead.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-muted-foreground text-sm">{lead.phone}</p>
                  </div>
                  <Badge variant="default">Ready</Badge>
                </div>
                <p className="text-muted-foreground text-sm">{lead.interestedCourse?.name ?? "No course set"}</p>
                <p className="text-muted-foreground text-xs">
                  {lead.source.replace("_", " ")} · {lead._count.followUps} follow-up
                  {lead._count.followUps === 1 ? "" : "s"} logged
                  {lead.assignedCounselor ? ` · ${lead.assignedCounselor.name}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`/admissions/convert/${lead.id}`}>Convert to student</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/crm/leads/${lead.id}`}>Open lead</Link>
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
