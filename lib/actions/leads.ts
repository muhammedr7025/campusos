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
import { assertOwned } from "@/lib/rbac/ownership";
import { BusinessRuleError } from "@/lib/actions/errors";
import { actionError, type ActionResult } from "@/lib/actions/types";

const digitsOf = (value: string) => value.replace(/[^0-9]/g, "");

/**
 * The person behind a phone number, if the institute already knows them: an
 * open enquiry or an admitted student. Bulk import has always checked this;
 * the one-at-a-time form didn't, so the same walk-in could be entered twice
 * and chased by two counselors.
 */
async function findExistingByPhone(tenantId: string, phone: string, excludeLeadId?: string) {
  const digits = digitsOf(phone);
  if (digits.length < 6) return null;
  const tail = digits.slice(-Math.min(10, digits.length));
  const [leads, students] = await Promise.all([
    prisma.lead.findMany({
      where: { tenantId, phone: { contains: tail.slice(-4) }, status: { not: "LOST" }, ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}) },
      select: { id: true, name: true, phone: true, status: true },
    }),
    prisma.student.findMany({
      where: { tenantId, phone: { contains: tail.slice(-4) } },
      select: { id: true, name: true, phone: true, enrollmentNumber: true },
    }),
  ]);
  const lead = leads.find((l) => digitsOf(l.phone).endsWith(tail));
  if (lead) return { kind: "lead" as const, ...lead };
  const student = students.find((s) => digitsOf(s.phone ?? "").endsWith(tail));
  if (student) return { kind: "student" as const, ...student };
  return null;
}

export async function createLead(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission("lead:manage");
    const tenantId = await getTenantId();
    const data = leadSchema.parse(input);

    await assertOwned(tenantId, { course: data.interestedCourseId, user: data.assignedCounselorId });

    const existing = await findExistingByPhone(tenantId, data.phone);
    if (existing) {
      throw new BusinessRuleError(
        existing.kind === "lead"
          ? `${existing.name} already has an open enquiry with this phone number (${existing.status.toLowerCase().replace("_", " ")}). Log a follow-up on it instead.`
          : `${existing.name} (${existing.enrollmentNumber}) is already an admitted student with this phone number.`,
      );
    }

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
      if (lead.status === "CONVERTED") {
        throw new BusinessRuleError("This enquiry has been converted — the student record is where their history continues.");
      }

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

      // Logging a follow-up is meaningful pipeline activity — a first contact
      // moves a new enquiry forward. Anything further along stays where the
      // counselor put it; a follow-up on a FOLLOW_UP lead is exactly what that
      // stage means, not a reason to move it back to CONTACTED.
      if (lead.status === "NEW") {
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
      // A converted enquiry is a student now; dragging it back onto the board
      // would let it be converted twice. A lost one may be reopened.
      if (lead.status === "CONVERTED") {
        throw new BusinessRuleError("This enquiry has already been converted to a student and can't be moved.");
      }
      await tx.lead.update({
        where: { id: lead.id },
        data: { status: data.status, ...(lead.status === "LOST" ? { lostReason: null } : {}) },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: lead.status === "LOST" ? "REOPEN" : "UPDATE_STATUS",
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

    await assertOwned(tenantId, { course: data.interestedCourseId, user: data.assignedCounselorId });

    const existing = await findExistingByPhone(tenantId, data.phone, leadId);
    if (existing && existing.kind === "lead") {
      throw new BusinessRuleError(`${existing.name} already has an open enquiry with this phone number.`);
    }

    await prisma.$transaction(async (tx) => {
      const before = await tx.lead.findFirstOrThrow({ where: { id: leadId, tenantId } });
      if (before.status === "CONVERTED") {
        throw new BusinessRuleError("This enquiry has been converted — edit the student's profile instead.");
      }
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
