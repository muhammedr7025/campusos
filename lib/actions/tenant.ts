"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { UPLOAD_RULES, uploadProblem } from "@/lib/storage/validate";
import { brandingSchema, admissionSettingsSchema } from "@/lib/validators/tenant";
import { STANDARD_KYC_DOCS } from "@/lib/admissions/kyc-files";
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

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload." };
    // Branding is served to anyone, signed in or not — so no SVG (scriptable)
    // and nothing that isn't plainly an image.
    const problem = uploadProblem(file, UPLOAD_RULES.logo);
    if (problem) return { ok: false, error: problem };

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storage.save({ tenantId, category: "branding", buffer, filename: file.name, contentType: file.type });

    return { ok: true, data: { url: stored.url } };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Which KYC documents are mandatory. Applies to students still awaiting KYC
 * as well as future admissions: their checklist rows are re-flagged, and any
 * who now have nothing mandatory outstanding become fully admitted. Students
 * already admitted aren't touched.
 */
export async function updateAdmissionSettings(input: unknown): Promise<ActionResult<{ promoted: number }>> {
  try {
    const session = await requirePermission("tenant:manage");
    const tenantId = await getTenantId();
    const data = admissionSettingsSchema.parse(input);
    const required = STANDARD_KYC_DOCS.filter((d) => data.requiredKycDocs.includes(d as (typeof data.requiredKycDocs)[number]));

    const promoted = await prisma.$transaction(async (tx) => {
      const before = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { requiredKycDocs: true } });
      await tx.tenant.update({ where: { id: tenantId }, data: { requiredKycDocs: required } });

      const pendingStudents = { tenantId, student: { status: "KYC_PENDING" as const } };
      await tx.kycDocument.updateMany({ where: { ...pendingStudents, docType: { in: required } }, data: { required: true } });
      await tx.kycDocument.updateMany({
        where: { ...pendingStudents, docType: { in: STANDARD_KYC_DOCS.filter((d) => !required.includes(d)) } },
        data: { required: false },
      });

      const ready = await tx.student.findMany({
        where: { tenantId, status: "KYC_PENDING", kycDocuments: { none: { required: true, status: { not: "VERIFIED" } } } },
        select: { id: true },
      });
      if (ready.length > 0) {
        await tx.student.updateMany({ where: { id: { in: ready.map((r) => r.id) } }, data: { status: "ACTIVE" } });
      }

      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE_SETTINGS",
        entityType: "Tenant",
        entityId: tenantId,
        diff: { requiredKycDocs: { from: before.requiredKycDocs, to: required }, promotedToActive: ready.length },
      });
      return ready.length;
    });

    revalidatePath("/admin/settings/branding");
    revalidatePath("/admissions/kyc");
    revalidatePath("/admissions/students");
    return { ok: true, data: { promoted } };
  } catch (error) {
    return actionError(error);
  }
}
