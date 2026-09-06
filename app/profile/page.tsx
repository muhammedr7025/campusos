import { requireSession } from "@/lib/rbac/guard";
import { getTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_LABEL } from "@/components/layout/nav-items";
import { ChangePasswordForm } from "@/components/profile/change-password-form";

export default async function ProfilePage() {
  const session = await requireSession();
  const tenantId = await getTenantId();

  const user = await prisma.user.findFirstOrThrow({
    where: { id: session.user.id, tenantId },
    select: { name: true, email: true, phone: true, role: true, createdAt: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="Account" title="My profile" description="Your account details and login." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Name</p>
              <p className="font-heading text-xl">{user.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Email</p>
              <p>{user.email}</p>
            </div>
            {user.phone && (
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Phone</p>
                <p>{user.phone}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Role</p>
              <p>{ROLE_LABEL[user.role]}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Member since</p>
              <p>{user.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
            </div>
          </CardContent>
        </Card>

        <ChangePasswordForm />
      </div>
    </div>
  );
}
