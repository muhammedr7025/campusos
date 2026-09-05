import Link from "next/link";
import { ClipboardCheck, UserPlus } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default async function PendingKycPage() {
  await requireRole(Role.SUPER_ADMIN, Role.ADMISSION_OFFICER);
  const tenantId = await getTenantId();

  const [readyLeads, pendingStudents] = await Promise.all([
    prisma.lead.findMany({
      where: { tenantId, status: { in: ["INTERESTED", "FOLLOW_UP"] } },
      include: { interestedCourse: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.student.findMany({
      where: { tenantId, status: "KYC_PENDING" },
      include: {
        course: { select: { name: true } },
        kycDocuments: { select: { status: true, required: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader crumb="Admissions" title="Conversion queue" description="Convert ready leads and clear the KYC-pending queue." />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ready to convert</h2>
        {readyLeads.length === 0 ? (
          <EmptyState icon={UserPlus} title="No leads ready yet" description="Leads marked Interested or Follow-up by Counselors show up here." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {readyLeads.map((lead) => (
              <Card key={lead.id}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <p className="font-medium">{lead.name}</p>
                  <p className="text-muted-foreground text-sm">{lead.phone}</p>
                  <p className="text-muted-foreground text-sm">{lead.interestedCourse?.name ?? "No course set"}</p>
                  <Button asChild size="sm" className="mt-1 w-fit">
                    <Link href={`/admissions/convert/${lead.id}`}>Start admission</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">KYC pending</h2>
        {pendingStudents.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nothing pending" description="Every admitted student has completed KYC." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingStudents.map((student) => {
              const verified = student.kycDocuments.filter((d) => d.status === "VERIFIED").length;
              const total = student.kycDocuments.length;
              return (
                <Link key={student.id} href={`/admissions/students/${student.id}`}>
                  <Card className="hover:border-primary/50 transition-colors">
                    <CardContent className="flex flex-col gap-2 p-4">
                      <p className="font-medium">{student.name}</p>
                      <p className="text-muted-foreground text-sm">{student.enrollmentNumber} · {student.course.name}</p>
                      <Badge variant={verified === total ? "default" : "secondary"} className="w-fit">
                        {verified}/{total} docs verified
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
