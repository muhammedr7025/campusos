import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/rbac/guard";
import { getCurrentTenant, getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { ROLE_LABEL, ROLE_DEFAULT_GROUP, GROUP_LABEL } from "@/components/layout/nav-items";

/**
 * Shared shell for every role-scoped route's layout.tsx (admin, finance,
 * crm, admissions, teacher, portal, and the cross-cutting profile route).
 *
 * The sidebar always reflects the signed-in role, never the current URL
 * segment: every role's pages already link out to other sections where the
 * design calls for it (e.g. Super Admin into Finance/CRM, Finance into the
 * shared audit log), and each of those target pages' own requireRole guard
 * is what actually decides who may view it — so the shell doesn't need a
 * per-route group at all, and using one would make the sidebar swap to that
 * route's section nav out from under the visitor.
 */
export async function RoleShell({ children }: { children: React.ReactNode }) {
  // requirePageSession, not auth(): the role in the token is a snapshot from
  // sign-in, so a demoted or deactivated user would otherwise keep their old
  // sidebar (and a live session) until the token expired.
  const [session, tenant] = await Promise.all([requirePageSession(), getCurrentTenant()]);
  if (!tenant) redirect("/login");

  const effectiveGroup = ROLE_DEFAULT_GROUP[session.user.role];
  const effectiveGroupLabel = GROUP_LABEL[effectiveGroup];

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
