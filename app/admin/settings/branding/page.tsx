import { requireRole } from "@/lib/rbac/guard";
import { getCurrentTenant } from "@/lib/tenant";
import { Role } from "@/generated/prisma/client";
import { BrandingForm } from "@/components/admin/branding-form";

export default async function BrandingSettingsPage() {
  await requireRole(Role.SUPER_ADMIN);
  const tenant = await getCurrentTenant();
  if (!tenant) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Branding</h1>
        <p className="text-muted-foreground text-sm">White-label this workspace — no code changes needed, just save.</p>
      </div>
      <BrandingForm
        initial={{
          name: tenant.name,
          logoUrl: tenant.logoUrl ?? "",
          faviconUrl: tenant.faviconUrl ?? "",
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
        }}
      />
    </div>
  );
}
