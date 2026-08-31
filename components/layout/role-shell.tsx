import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentTenant, getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { ROLE_LABEL, type NAV_ITEMS_BY_GROUP } from "@/components/layout/nav-items";

/** Shared shell for every role-scoped route group layout — see app/admin|finance|crm|admissions|teacher|portal/layout.tsx. */
export async function RoleShell({
  group,
  groupLabel,
  children,
}: {
  group: keyof typeof NAV_ITEMS_BY_GROUP;
  groupLabel: string;
  children: React.ReactNode;
}) {
  const [session, tenant] = await Promise.all([auth(), getCurrentTenant()]);
  if (!session?.user || !tenant) redirect("/login");

  const tenantId = await getTenantId();
  const enableCommandPalette = ["admin", "finance", "crm"].includes(group);
  const notifications = await prisma.notification.findMany({
    where: { tenantId, recipientId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <AppShell
      group={group}
      groupLabel={groupLabel}
      tenantName={tenant.name}
      tenantLogoUrl={tenant.logoUrl}
      userName={session.user.name}
      userEmail={session.user.email}
      roleLabel={ROLE_LABEL[session.user.role]}
      enableCommandPalette={enableCommandPalette}
      notifications={notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      }))}
    >
      {children}
    </AppShell>
  );
}
