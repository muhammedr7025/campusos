import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, Mail, Clock } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadStatusBadge } from "@/components/crm/lead-status-badge";
import { StageSelect } from "@/components/crm/stage-select";
import { LogFollowUpDialog } from "@/components/crm/log-follow-up-dialog";
import { MarkLostDialog } from "@/components/crm/mark-lost-dialog";
import { LeadFormDialog } from "@/components/crm/lead-form-dialog";
import { DeleteLeadButton } from "@/components/crm/delete-lead-button";
import { EmptyState } from "@/components/layout/empty-state";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(Role.SUPER_ADMIN, Role.COUNSELOR);
  const tenantId = await getTenantId();
  const { id } = await params;

  const [lead, courses] = await Promise.all([
    prisma.lead.findFirst({
      where: { id, tenantId },
      include: {
        interestedCourse: { select: { name: true } },
        assignedCounselor: { select: { name: true } },
        followUps: { orderBy: { createdAt: "desc" }, include: { createdBy: { select: { name: true } } } },
      },
    }),
    prisma.course.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  if (!lead) notFound();

  const editable = !["CONVERTED", "LOST"].includes(lead.status);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/crm/leads" className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Back to leads
      </Link>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{lead.name}</CardTitle>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1"><Phone className="size-3.5" /> {lead.phone}</span>
              {lead.email && <span className="flex items-center gap-1"><Mail className="size-3.5" /> {lead.email}</span>}
            </div>
          </div>
          <LeadStatusBadge status={lead.status} />
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div><span className="text-muted-foreground">Source: </span>{lead.source.replace("_", " ")}</div>
          <div><span className="text-muted-foreground">Interested course: </span>{lead.interestedCourse?.name ?? "—"}</div>
          <div><span className="text-muted-foreground">Counselor: </span>{lead.assignedCounselor?.name ?? "Unassigned"}</div>
          {lead.status === "LOST" && lead.lostReason && (
            <div className="text-destructive"><span className="text-muted-foreground">Lost reason: </span>{lead.lostReason}</div>
          )}
        </CardContent>
        <CardContent className="flex flex-wrap items-center gap-2 pt-0">
          <LeadFormDialog
            courses={courses}
            lead={{ id: lead.id, name: lead.name, phone: lead.phone, email: lead.email, source: lead.source, interestedCourseId: lead.interestedCourseId }}
          />
          {editable && (
            <>
              <StageSelect leadId={lead.id} status={lead.status} />
              <LogFollowUpDialog leadId={lead.id} leadName={lead.name} />
              <MarkLostDialog leadId={lead.id} leadName={lead.name} />
            </>
          )}
          <DeleteLeadButton leadId={lead.id} leadName={lead.name} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Follow-up timeline</h2>
        {lead.followUps.length === 0 ? (
          <EmptyState icon={Clock} title="No follow-ups logged yet" description="Log the first touch-point to start tracking this lead." />
        ) : (
          <div className="flex flex-col gap-3">
            {lead.followUps.map((f) => (
              <Card key={f.id}>
                <CardContent className="flex flex-col gap-1 p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{f.type}</Badge>
                    <span className="text-muted-foreground text-xs">{f.createdAt.toLocaleString()}</span>
                  </div>
                  {f.notes && <p className="text-sm">{f.notes}</p>}
                  <div className="text-muted-foreground flex flex-wrap gap-x-4 text-xs">
                    <span>By {f.createdBy.name}</span>
                    {f.completedAt && <span>Completed {f.completedAt.toLocaleDateString()}</span>}
                    {f.scheduledAt && <span>Next: {f.scheduledAt.toLocaleDateString()}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
