"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { brandingSchema } from "@/lib/validators/tenant";
import { actionError, type ActionResult } from "@/lib/actions/types";

export async function updateBranding(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("tenant:manage");
    const tenantId = await getTenantId();
    const data = brandingSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name: data.name,
          logoUrl: data.logoUrl || null,
          faviconUrl: data.faviconUrl || null,
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
          accentColor: data.accentColor,
        },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "Tenant",
        entityId: tenantId,
        diff: data,
      });
    });

    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadBrandingAsset(formData: FormData): Promise<ActionResult<{ url: string }>> {
  try {
    await requirePermission("tenant:manage");
    const tenantId = await getTenantId();

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return { ok: false, error: "Choose a file to upload." };

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storage.save({ tenantId, category: "branding", buffer, filename: file.name, contentType: file.type });

    return { ok: true, data: { url: stored.url } };
  } catch (error) {
    return actionError(error);
  }
}
