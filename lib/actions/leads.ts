"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import {
  leadSchema,
  followUpSchema,
  leadStageSchema,
  lostLeadSchema,
  bulkImportSchema,
  type BulkImportRow,
} from "@/lib/validators/leads";
import { actionError, type ActionResult } from "@/lib/actions/types";

export async function createLead(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("lead:manage");
    const tenantId = await getTenantId();
    const data = leadSchema.parse(input);

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          tenantId,
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          source: data.source,
          interestedCourseId: data.interestedCourseId || null,
          assignedCounselorId: data.assignedCounselorId || session.user.id,
        },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "Lead",
        entityId: created.id,
        diff: data,
      });
      return created;
    });

    revalidatePath("/crm/leads");
    return { ok: true, data: { id: lead.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function logFollowUp(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("lead:manage");
    const tenantId = await getTenantId();
    const data = followUpSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirstOrThrow({ where: { id: data.leadId, tenantId } });

      await tx.followUp.create({
        data: {
          tenantId,
          leadId: data.leadId,
          type: data.type,
          notes: data.notes || null,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          completedAt: data.completedNow ? new Date() : null,
          createdById: session.user.id,
        },
      });

      // Logging a follow-up is meaningful pipeline activity — nudge status
      // forward automatically unless already further along.
      if (lead.status === "NEW") {
        await tx.lead.update({ where: { id: lead.id }, data: { status: "CONTACTED" } });
      } else if (lead.status === "FOLLOW_UP") {
        await tx.lead.update({ where: { id: lead.id }, data: { status: "CONTACTED" } });
      }
    });

    revalidatePath("/crm/leads");
    revalidatePath(`/crm/leads/${data.leadId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function changeLeadStage(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("lead:manage");
    const tenantId = await getTenantId();
    const data = leadStageSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirstOrThrow({ where: { id: data.leadId, tenantId } });
      await tx.lead.update({ where: { id: lead.id }, data: { status: data.status } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE_STATUS",
        entityType: "Lead",
        entityId: lead.id,
        diff: { from: lead.status, to: data.status },
      });
    });

    revalidatePath("/crm/leads");
    revalidatePath(`/crm/leads/${data.leadId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function markLeadLost(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("lead:manage");
    const tenantId = await getTenantId();
    const data = lostLeadSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirstOrThrow({ where: { id: data.leadId, tenantId } });
      await tx.lead.update({
        where: { id: lead.id },
        data: { status: "LOST", lostReason: data.reason },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "MARK_LOST",
        entityType: "Lead",
        entityId: lead.id,
        diff: { reason: data.reason },
      });
    });

    revalidatePath("/crm/leads");
    revalidatePath(`/crm/leads/${data.leadId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateLead(leadId: string, input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("lead:manage");
    const tenantId = await getTenantId();
    const data = leadSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const before = await tx.lead.findFirstOrThrow({ where: { id: leadId, tenantId } });
      await tx.lead.update({
        where: { id: leadId },
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          source: data.source,
          interestedCourseId: data.interestedCourseId || null,
          assignedCounselorId: data.assignedCounselorId || before.assignedCounselorId,
        },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "Lead",
        entityId: leadId,
        diff: { before: { name: before.name, phone: before.phone }, after: data },
      });
    });

    revalidatePath("/crm/leads");
    revalidatePath(`/crm/leads/${leadId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteLead(leadId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("lead:manage");
    const tenantId = await getTenantId();

    const lead = await prisma.lead.findFirstOrThrow({ where: { id: leadId, tenantId } });
    if (lead.status === "CONVERTED") {
      return { ok: false, error: "Can't delete a lead that has already been converted to a student." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.followUp.deleteMany({ where: { leadId, tenantId } });
      await tx.lead.delete({ where: { id: leadId } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "DELETE",
        entityType: "Lead",
        entityId: leadId,
        diff: { name: lead.name },
      });
    });

    revalidatePath("/crm/leads");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export type BulkImportResult = { imported: number; skipped: number };

/**
 * Re-validates dedupe server-side rather than trusting the client's preview
 * — a phone number could have been captured by someone else between the
 * user pasting the sheet and hitting import.
 */
export async function bulkImportLeads(input: unknown): Promise<ActionResult<BulkImportResult>> {
  try {
    const session = await requirePermission("lead:manage");
    const tenantId = await getTenantId();
    const data = bulkImportSchema.parse(input);

    const [existingLeads, existingStudents, courses] = await Promise.all([
      prisma.lead.findMany({ where: { tenantId }, select: { phone: true } }),
      prisma.student.findMany({ where: { tenantId }, select: { phone: true } }),
      prisma.course.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    ]);

    const digitsOf = (v: string) => v.replace(/[^0-9]/g, "");
    const knownPhones = new Set(
      [...existingLeads, ...existingStudents].map((x) => digitsOf(x.phone ?? "")).filter((d) => d.length > 5),
    );

    const seenInBatch = new Set<string>();
    const toCreate: { name: string; phone: string; interestedCourseId: string | null; source: BulkImportRow["source"] }[] = [];
    let skipped = 0;

    for (const row of data.rows) {
      const digits = digitsOf(row.phone);
      if (digits.length < 10 || knownPhones.has(digits) || seenInBatch.has(digits)) {
        skipped += 1;
        continue;
      }
      seenInBatch.add(digits);
      const course = row.courseName ? courses.find((c) => c.name.toLowerCase() === row.courseName!.toLowerCase()) : undefined;
      toCreate.push({ name: row.name, phone: row.phone, interestedCourseId: course?.id ?? null, source: row.source });
    }

    if (toCreate.length === 0) {
      return { ok: true, data: { imported: 0, skipped } };
    }

    await prisma.$transaction(async (tx) => {
      for (const row of toCreate) {
        await tx.lead.create({
          data: {
            tenantId,
            name: row.name,
            phone: row.phone,
            source: row.source,
            interestedCourseId: row.interestedCourseId,
            assignedCounselorId: session.user.id,
          },
        });
      }
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "IMPORTED",
        entityType: "Lead",
        entityId: "bulk",
        diff: { imported: toCreate.length, skipped },
      });
    });

    revalidatePath("/crm/leads");
    return { ok: true, data: { imported: toCreate.length, skipped } };
  } catch (error) {
    return actionError(error);
  }
}
