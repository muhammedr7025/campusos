import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConvertLeadForm } from "@/components/admissions/convert-lead-form";

export default async function ConvertLeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  await requireRole(Role.SUPER_ADMIN, Role.ADMISSION_OFFICER);
  const tenantId = await getTenantId();
  const { leadId } = await params;

  const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } });
  if (!lead) notFound();

  const courses = await prisma.course.findMany({
    where: { tenantId },
    include: { divisions: { include: { _count: { select: { students: { where: ENROLLED_STUDENT_WHERE } } } } } },
    orderBy: { name: "asc" },
  });

  const courseOptions = courses.map((c) => ({
    id: c.id,
    name: c.name,
    divisions: c.divisions.map((d) => ({ id: d.id, name: d.name, capacity: d.capacity, studentCount: d._count.students })),
  }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/admissions/queue" className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Admit {lead.name}</CardTitle>
          <CardDescription>Confirm course/division, capture guardian details, and generate the fee plan — one guided step.</CardDescription>
        </CardHeader>
        <CardContent>
          <ConvertLeadForm
            leadId={lead.id}
            leadName={lead.name}
            defaultCourseId={lead.interestedCourseId ?? undefined}
            courses={courseOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
