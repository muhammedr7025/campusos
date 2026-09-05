import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role, LeadSource } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SOURCE_LABEL: Record<LeadSource, string> = {
  WALK_IN: "Walk-in",
  PHONE: "Phone call",
  WEB: "Web form",
  REFERRAL: "Referral",
  OTHER: "Other",
};

export default async function SourcePerformancePage() {
  await requireRole(Role.SUPER_ADMIN, Role.COUNSELOR);
  const tenantId = await getTenantId();

  const leads = await prisma.lead.findMany({ where: { tenantId }, select: { source: true, status: true } });

  const rows = (Object.keys(SOURCE_LABEL) as LeadSource[])
    .map((source) => {
      const forSource = leads.filter((l) => l.source === source);
      const enquiries = forSource.length;
      const admitted = forSource.filter((l) => l.status === "CONVERTED").length;
      const lost = forSource.filter((l) => l.status === "LOST").length;
      const open = enquiries - admitted - lost;
      const rate = enquiries > 0 ? Math.round((admitted / enquiries) * 100) : 0;
      return { source, enquiries, admitted, lost, open, rate };
    })
    .filter((r) => r.enquiries > 0)
    .sort((a, b) => b.enquiries - a.enquiries);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="CRM"
        title="Lead source performance"
        description="Enquiries = every lead ever captured through that channel. Referral usually closes strongest; paid/social brings volume at a lower rate — that's the spend decision."
      />

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No leads captured yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.source}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{SOURCE_LABEL[r.source]}</span>
                  <Badge variant={r.rate >= 40 ? "default" : r.rate >= 20 ? "warning" : "destructive"}>{r.rate}%</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <div className="font-heading text-xl">{r.enquiries}</div>
                    <div className="text-muted-foreground text-[11px] uppercase">Enquiries</div>
                  </div>
                  <div>
                    <div className="font-heading text-xl text-[#15584A]">{r.admitted}</div>
                    <div className="text-muted-foreground text-[11px] uppercase">Admitted</div>
                  </div>
                  <div>
                    <div className="font-heading text-xl">{r.open}</div>
                    <div className="text-muted-foreground text-[11px] uppercase">Open</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
