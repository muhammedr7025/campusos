import Link from "next/link";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { XCircle } from "lucide-react";

export default async function LostReasonsPage() {
  await requireRole(Role.SUPER_ADMIN, Role.COUNSELOR);
  const tenantId = await getTenantId();

  const leads = await prisma.lead.findMany({
    where: { tenantId, status: "LOST" },
    include: { interestedCourse: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const byReason = new Map<string, number>();
  for (const lead of leads) {
    const reason = lead.lostReason?.trim() || "Not recorded";
    byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  }
  const reasonSummary = [...byReason.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="CRM"
        title="Lost-lead reasons"
        description="Every lost lead carries a reason, so drop-off can be analysed instead of guessed at."
      />

      {leads.length === 0 ? (
        <EmptyState icon={XCircle} title="No lost leads yet" />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {reasonSummary.map(([reason, count]) => (
              <Badge key={reason} variant="secondary" className="px-3 py-1.5 text-[13px] font-semibold">
                {reason} <span className="text-muted-foreground ml-1 font-normal">· {count}</span>
              </Badge>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {leads.map((lead) => (
              <Link key={lead.id} href={`/crm/leads/${lead.id}`}>
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {lead.phone} · {lead.interestedCourse?.name ?? "No course"} · {lead.source.replace("_", " ")}
                      </p>
                    </div>
                    <Badge variant="destructive">{lead.lostReason || "Not recorded"}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
