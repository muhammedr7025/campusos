import Link from "next/link";
import { AlertCircle, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadStatusBadge, LEAD_STATUS_LABEL } from "@/components/crm/lead-status-badge";
import { StageSelect } from "@/components/crm/stage-select";
import { LogFollowUpDialog } from "@/components/crm/log-follow-up-dialog";
import { MarkLostDialog } from "@/components/crm/mark-lost-dialog";
import type { LeadRow } from "@/components/crm/lead-row-types";
import type { LeadStatus } from "@/generated/prisma/client";

const COLUMNS: LeadStatus[] = ["NEW", "CONTACTED", "INTERESTED", "FOLLOW_UP", "CONVERTED", "LOST"];

function LeadCard({ lead }: { lead: LeadRow }) {
  const editable = !["CONVERTED", "LOST"].includes(lead.status);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/crm/leads/${lead.id}`} className="font-medium hover:underline">
            {lead.name}
          </Link>
          {lead.isOverdue && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="size-3" /> Overdue
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <Phone className="size-3" /> {lead.phone}
        </p>
        {lead.courseName && <p className="text-muted-foreground text-xs">{lead.courseName}</p>}
        {lead.counselorName && <p className="text-muted-foreground text-xs">Owner: {lead.counselorName}</p>}
        {lead.status === "LOST" && lead.lostReason && (
          <p className="text-destructive text-xs">Reason: {lead.lostReason}</p>
        )}
        {editable && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StageSelect leadId={lead.id} status={lead.status} />
            <LogFollowUpDialog leadId={lead.id} leadName={lead.name} trigger={<button className="text-xs underline">Log follow-up</button>} />
            <MarkLostDialog leadId={lead.id} leadName={lead.name} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LeadsKanban({ leads }: { leads: LeadRow[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((status) => {
        const columnLeads = leads.filter((lead) => lead.status === status);
        return (
          <div key={status} className="flex w-72 shrink-0 flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <LeadStatusBadge status={status} />
                <span className="text-muted-foreground text-xs">{LEAD_STATUS_LABEL[status]}</span>
              </div>
              <span className="text-muted-foreground text-xs">{columnLeads.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {columnLeads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
              {columnLeads.length === 0 && (
                <p className="text-muted-foreground border-muted rounded-md border border-dashed p-4 text-center text-xs">
                  No leads
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
