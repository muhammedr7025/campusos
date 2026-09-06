import { Megaphone } from "lucide-react";
import { requireRole } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { FilterPills } from "@/components/layout/filter-pills";
import { AnnouncementFormDialog } from "@/components/admin/announcement-form-dialog";
import { DeleteAnnouncementButton } from "@/components/admin/delete-announcement-button";

const AUDIENCES = ["All", "EVERYONE", "PARENTS", "STUDENTS", "TEACHERS"] as const;

/** Who a given audience actually reaches, so the author can see the blast radius before sending again. */
const AUDIENCE_ROLES: Record<string, Role[]> = {
  EVERYONE: [Role.SUPER_ADMIN, Role.FINANCE, Role.COUNSELOR, Role.ADMISSION_OFFICER, Role.TEACHER, Role.STUDENT, Role.PARENT],
  PARENTS: [Role.PARENT],
  STUDENTS: [Role.STUDENT],
  TEACHERS: [Role.TEACHER],
};

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(Role.SUPER_ADMIN);
  const tenantId = await getTenantId();
  const params = await searchParams;
  const filter = (AUDIENCES as readonly string[]).includes(params.audience ?? "") ? params.audience! : "All";

  const [announcements, activeUsers] = await Promise.all([
    prisma.announcement.findMany({
      where: { tenantId, ...(filter === "All" ? {} : { audience: filter as never }) },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.groupBy({ by: ["role"], where: { tenantId, isActive: true }, _count: { _all: true } }),
  ]);

  const countByRole = new Map(activeUsers.map((r) => [r.role, r._count._all]));
  const reachFor = (audience: string) =>
    (AUDIENCE_ROLES[audience] ?? []).reduce((sum, role) => sum + (countByRole.get(role) ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Governance"
        title="Announcements"
        description="Broadcast notices to everyone, or a specific audience."
        actions={<AnnouncementFormDialog />}
      />

      <FilterPills options={[...AUDIENCES]} active={filter} paramKey="audience" />

      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title={filter === "All" ? "No announcements yet" : "Nothing for this audience"} />
      ) : (
        <div className="flex flex-col gap-2">
          {announcements.map((a) => {
            const reach = reachFor(a.audience);
            return (
              <Card key={a.id}>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{a.title}</p>
                      <Badge variant="secondary">{a.audience}</Badge>
                      <span className="text-muted-foreground text-xs">
                        {reach} recipient{reach === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">{a.body}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {a.author.name} · {a.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <AnnouncementFormDialog
                      announcement={{ id: a.id, title: a.title, body: a.body, audience: a.audience }}
                    />
                    <DeleteAnnouncementButton id={a.id} title={a.title} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
