import { Megaphone } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { AnnouncementFormDialog } from "@/components/admin/announcement-form-dialog";
import { DeleteAnnouncementButton } from "@/components/admin/delete-announcement-button";

export default async function AnnouncementsPage() {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();

  const announcements = await prisma.announcement.findMany({
    where: { tenantId },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Governance"
        title="Announcements"
        description="Broadcast notices to everyone, or a specific audience."
        actions={<AnnouncementFormDialog />}
      />

      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{a.title}</p>
                    <Badge variant="secondary">{a.audience}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{a.body}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {a.author.name} · {a.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <DeleteAnnouncementButton id={a.id} title={a.title} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
