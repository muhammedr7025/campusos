import { CalendarClock } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { isFollowUpOverdue, nextFollowUpDate } from "@/lib/crm/follow-ups";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { FilterPills } from "@/components/layout/filter-pills";
import { FollowUpsTable, type FollowUpRow } from "@/components/crm/follow-ups-table";

const FILTERS = ["Overdue", "Upcoming", "All open"] as const;

/**
 * Leads whose promised follow-up has slipped. The design calls this out as the
 * single biggest cause of lead leakage, so it gets its own queue rather than
 * living as a filter on the pipeline.
 */
export default async function FollowUpsDuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN, Role.COUNSELOR);
  const tenantId = await getTenantId();
  const params = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(params.due ?? "") ? params.due! : "Overdue";

  const leads = await prisma.lead.findMany({
    where: { tenantId, status: { notIn: ["CONVERTED", "LOST"] } },
    include: {
      interestedCourse: { select: { name: true } },
      assignedCounselor: { select: { name: true } },
      followUps: { select: { scheduledAt: true, completedAt: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const now = new Date();
  const allRows: FollowUpRow[] = leads
    .map((lead) => {
      const due = nextFollowUpDate(lead.followUps, now);
      return {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        courseName: lead.interestedCourse?.name ?? null,
        source: lead.source,
        status: lead.status,
        counselorName: lead.assignedCounselor?.name ?? null,
        dueAt: due ? due.toISOString() : null,
        isOverdue: isFollowUpOverdue(lead.followUps, now),
      };
    })
    .filter((r) => r.dueAt != null)
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  const rows = allRows.filter((r) =>
    filter === "Overdue" ? r.isOverdue : filter === "Upcoming" ? !r.isOverdue : true,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="CRM"
        title="Follow-ups due"
        description="Anything past its scheduled date with no activity logged against it lands here."
      />

      <FilterPills options={[...FILTERS]} active={filter} paramKey="due" />

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={filter === "Overdue" ? "Nothing overdue" : "Nothing scheduled"}
          description={filter === "Overdue" ? "Every promised follow-up has been logged." : undefined}
        />
      ) : (
        <FollowUpsTable rows={rows} />
      )}
    </div>
  );
}
