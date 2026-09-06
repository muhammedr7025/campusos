import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentTenant, getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { AppShell } from "@/components/layout/app-shell";
import { ROLE_LABEL, ROLE_DEFAULT_GROUP, type NAV_ITEMS_BY_GROUP } from "@/components/layout/nav-items";

/**
 * Shared shell for every role-scoped route group layout — see
 * app/admin|finance|crm|admissions|teacher|portal/layout.tsx, plus the
 * shared app/profile/layout.tsx (which passes no group/groupLabel).
 *
 * Super Admin has permission to cross into every other section (see the
 * requireRole(SUPER_ADMIN, X) guards on those pages), so it always sees the
 * full admin sidebar rather than whichever section's nav it's currently
 * standing in — otherwise following an admin nav link into e.g. Finance
 * would swap the sidebar out from under them.
 */
export async function RoleShell({
  group,
  groupLabel,
  children,
}: {
  group?: keyof typeof NAV_ITEMS_BY_GROUP;
  groupLabel?: string;
  children: React.ReactNode;
}) {
  const [session, tenant] = await Promise.all([auth(), getCurrentTenant()]);
  if (!session?.user || !tenant) redirect("/login");

  const effectiveGroup =
    session.user.role === Role.SUPER_ADMIN ? "admin" : (group ?? ROLE_DEFAULT_GROUP[session.user.role]);
  const effectiveGroupLabel = session.user.role === Role.SUPER_ADMIN ? "Admin" : (groupLabel ?? ROLE_LABEL[session.user.role]);

  const tenantId = await getTenantId();
  const enableCommandPalette = ["admin", "finance", "crm"].includes(effectiveGroup);
  const notifications = await prisma.notification.findMany({
    where: { tenantId, recipientId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <AppShell
      group={effectiveGroup}
      groupLabel={effectiveGroupLabel}
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
