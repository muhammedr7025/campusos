import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { LeadsView } from "@/components/crm/leads-view";
import { PageHeader } from "@/components/layout/page-header";
import type { LeadRow } from "@/components/crm/lead-row-types";
import type { Prisma } from "@/generated/prisma/client";
import { FilterPills } from "@/components/layout/filter-pills";

const STAGES = ["NEW", "CONTACTED", "INTERESTED", "FOLLOW_UP", "READY", "CONVERTED", "LOST"];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN, Role.COUNSELOR);
  const tenantId = await getTenantId();
  const params = await searchParams;
  const isTable = params.view === "table";

  const where: Prisma.LeadWhereInput = { tenantId };
  // Stage pills apply to the table view; the kanban shows every column at once.
  if (params.stage && STAGES.includes(params.stage)) where.status = params.stage as never;
  if (params.counselor) where.assignedCounselorId = params.counselor;
  if (params.source) where.source = params.source as Prisma.LeadWhereInput["source"];
  if (params.course) where.interestedCourseId = params.course;
  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: new Date(params.from) } : {}),
      ...(params.to ? { lte: new Date(`${params.to}T23:59:59`) } : {}),
    };
  }

  const [leads, counselors, courses] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        interestedCourse: { select: { name: true } },
        assignedCounselor: { select: { name: true } },
        followUps: { select: { scheduledAt: true, completedAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { tenantId, role: Role.COUNSELOR }, select: { id: true, name: true } }),
    prisma.course.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const now = new Date();
  const rows: LeadRow[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    status: lead.status,
    lostReason: lead.lostReason,
    courseName: lead.interestedCourse?.name ?? null,
    counselorName: lead.assignedCounselor?.name ?? null,
    createdAt: lead.createdAt.toISOString(),
    isOverdue: lead.followUps.some((f) => f.scheduledAt && !f.completedAt && f.scheduledAt < now),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="CRM" title="Lead pipeline" description="Follow every inquiry until it converts or is explicitly lost." />
      {isTable && <FilterPills options={["All", ...STAGES]} active={params.stage ?? "All"} paramKey="stage" />}
      <LeadsView
        leads={rows}
        courses={courses}
        counselors={counselors}
        initialView={params.view === "table" ? "table" : "kanban"}
      />
    </div>
  );
}
