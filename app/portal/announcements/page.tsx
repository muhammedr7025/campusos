import { Megaphone } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";

export default async function PortalAnnouncementsPage() {
  const session = await requireRole(Role.STUDENT, Role.PARENT);
  const tenantId = await getTenantId();

  const audience = session.user.role === Role.STUDENT ? "STUDENTS" : "PARENTS";

  const announcements = await prisma.announcement.findMany({
    where: { tenantId, OR: [{ audience: "EVERYONE" }, { audience }] },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="School" title="Announcements" description="Notices from the institute." />

      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{a.title}</p>
                  <Badge variant="secondary">{a.audience === "EVERYONE" ? "Everyone" : a.audience}</Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{a.body}</p>
                <p className="text-muted-foreground mt-1 text-xs">{a.createdAt.toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
