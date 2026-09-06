import { Megaphone } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

/** Read-only: notices addressed to everyone. Admin owns creating and editing them. */
export default async function AdmissionsNoticesPage() {
  await requireRole(Role.SUPER_ADMIN, Role.ADMISSION_OFFICER);
  const tenantId = await getTenantId();

  const announcements = await prisma.announcement.findMany({
    where: { tenantId, audience: "EVERYONE" },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Admissions"
        title="Notices"
        description="Institute-wide announcements. Parents and students see these in their portal too."
      />

      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="No notices yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-col gap-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{a.title}</p>
                  <Badge variant="secondary">{a.audience}</Badge>
                </div>
                <p className="text-muted-foreground text-sm">{a.body}</p>
                <p className="text-muted-foreground text-xs">
                  {a.author.name} · {a.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
