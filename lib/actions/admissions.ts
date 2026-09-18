"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";
import { getCurrentTenant, getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { generateTempPassword, hashPassword } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import { enrollStudent, isEnrollmentNumberClash, normalizeEmail, type EnrollStudentResult } from "@/lib/admissions/enroll";
import { STANDARD_KYC_DOCS, kycFileField, kycFileProblem } from "@/lib/admissions/kyc-files";
import { syncSubmissionsForStudent } from "@/lib/academics/submissions";
import {
  convertLeadSchema,
  kycStatusSchema,
  studentProfileSchema,
  reassignDivisionSchema,
  studentStatusSchema,
  admitStudentSchema,
  guardianProfileSchema,
} from "@/lib/validators/admissions";
import { BusinessRuleError } from "@/lib/actions/errors";
import { actionError, type ActionResult } from "@/lib/actions/types";
import type { KycDocType } from "@/generated/prisma/client";

export type ConvertLeadResult = EnrollStudentResult;
export type AdmitStudentResult = EnrollStudentResult;

type KycUploads = Partial<Record<KycDocType, File>>;

/**
 * An admission form arrives as FormData when documents ride along with it,
 * or as a plain object when they don't. Either way the same validator runs
 * on the fields; the files are pulled out by their per-document keys.
 */
function splitAdmissionInput(input: unknown, fieldNames: readonly string[]): { fields: unknown; files: KycUploads } {
  if (!(input instanceof FormData)) return { fields: input, files: {} };

  const fields: Record<string, string> = {};
  for (const name of fieldNames) {
    const value = input.get(name);
    fields[name] = typeof value === "string" ? value : "";
  }

  const files: KycUploads = {};
  for (const docType of STANDARD_KYC_DOCS) {
    const file = input.get(kycFileField(docType));
    if (file instanceof File && file.size > 0) files[docType] = file;
  }
  return { fields, files };
}

/**
 * Checks and stores the documents before the transaction opens, so a slow
 * upload never holds a database transaction — an orphaned file is harmless,
 * a half-written admission isn't.
 */
async function storeKycUploads(tenantId: string, files: KycUploads) {
  for (const file of Object.values(files)) {
    const problem = kycFileProblem(file);
    if (problem) throw new BusinessRuleError(problem);
  }

  const stored: Partial<Record<KycDocType, { url: string }>> = {};
  for (const [docType, file] of Object.entries(files) as [KycDocType, File][]) {
    stored[docType] = await storage.save({
      tenantId,
      category: "kyc",
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      contentType: file.type,
    });
  }
  return stored;
}

async function loadDivisionWithSeats(tenantId: string, divisionId: string, courseId: string) {
  return prisma.division.findFirst({
    where: { id: divisionId, tenantId, courseId },
    include: { _count: { select: { students: { where: ENROLLED_STUDENT_WHERE } } } },
  });
}

/**
 * The structure a new student is billed on: the course's oldest, so the
 * choice is stable rather than whatever row Postgres returns first. When a
 * course has several, the officer is told which was used — Finance can
 * override the plan afterwards.
 */
async function loadFeeStructure(tenantId: string, courseId: string) {
  const structures = await prisma.feeStructure.findMany({
    where: { tenantId, courseId },
    include: { installments: { orderBy: { sequence: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  const chosen = structures[0] ?? null;
  const note = !chosen
    ? "This course has no fee structure yet, so no fee plan was created. Finance can add one from the student's fee page."
    : structures.length > 1
      ? `This course has ${structures.length} fee structures; the student was billed on "${chosen.name}". Finance can override it if another applies.`
      : null;
  return { structure: chosen, note };
}

/**
 * Two officers admitting at the same moment can both compute the same next
 * enrollment number; the unique index catches it, and the whole transaction
 * re-runs to pick the number after. (A retry *inside* the transaction can't
 * work — Postgres aborts the transaction on the first failed statement.)
 */
async function withEnrollmentRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!isEnrollmentNumberClash(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

const CONVERT_FIELDS = Object.keys(convertLeadSchema.shape);
const ADMIT_FIELDS = Object.keys(admitStudentSchema.shape);

export async function convertLead(input: unknown): Promise<ActionResult<ConvertLeadResult>> {
  try {
    const session = await requirePermission("lead:convert");
    const tenant = await getCurrentTenant();
    if (!tenant) throw new Error("No tenant resolved.");
    const tenantId = tenant.id;
    const { fields, files } = splitAdmissionInput(input, CONVERT_FIELDS);
    const data = convertLeadSchema.parse(fields);

    const lead = await prisma.lead.findFirstOrThrow({ where: { id: data.leadId, tenantId } });
    if (lead.status === "CONVERTED") return { ok: false, error: "This lead has already been converted." };
    if (lead.status === "LOST") return { ok: false, error: "This lead is marked lost." };

    const division = await loadDivisionWithSeats(tenantId, data.divisionId, data.courseId);
    if (!division) return { ok: false, error: "That division doesn't belong to the selected course." };
    if (division.capacity != null && division._count.students >= division.capacity) {
      return { ok: false, error: `${division.name} is at capacity (${division.capacity}). Choose another division.` };
    }

    const { structure: feeStructure, note: feeNote } = await loadFeeStructure(tenantId, data.courseId);
    const kycFiles = await storeKycUploads(tenantId, files);

    const result = await withEnrollmentRetry(() =>
      prisma.$transaction(async (tx) => {
        const enrolled = await enrollStudent(tx, {
          tenantId,
          tenantSubdomain: tenant.subdomain,
          actorId: session.user.id,
          person: { name: lead.name, phone: lead.phone, email: lead.email, dob: data.dob, address: data.address },
          courseId: data.courseId,
          divisionId: data.divisionId,
          guardian: {
            name: data.guardianName,
            phone: data.guardianPhone,
            email: data.guardianEmail,
            relationship: data.guardianRelationship,
          },
          convertedFromLeadId: lead.id,
          requiredKycDocs: tenant.requiredKycDocs,
          kycFiles,
          feeStructure,
        });

        await tx.lead.update({ where: { id: lead.id }, data: { status: "CONVERTED" } });

        await writeAuditLog(tx, {
          tenantId,
          actorId: session.user.id,
          action: "CONVERT",
          entityType: "Lead",
          entityId: lead.id,
          diff: { studentId: enrolled.studentId, enrollmentNumber: enrolled.enrollmentNumber },
        });
        await writeAuditLog(tx, {
          tenantId,
          actorId: session.user.id,
          action: "CREATE",
          entityType: "Student",
          entityId: enrolled.studentId,
          diff: { convertedFromLeadId: lead.id, courseId: data.courseId, divisionId: data.divisionId },
        });

        return enrolled;
      }),
    );

    revalidatePath("/crm/leads");
    revalidatePath("/admissions/queue");
    revalidatePath("/admissions/kyc");
    revalidatePath("/admissions/students");
    revalidatePath("/admin/divisions");

    return { ok: true, data: feeNote ? { ...result, notes: [...result.notes, feeNote] } : result };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Admits a walk-in directly, with no lead record in the picture. Everything
 * downstream of a conversion still happens — portal logins, guardian linkage,
 * fee plan, KYC checklist, enrollment row — so a directly admitted student is
 * indistinguishable from a converted one afterwards.
 */
export async function admitStudent(input: unknown): Promise<ActionResult<AdmitStudentResult>> {
  try {
    const session = await requirePermission("student:manage");
    const tenant = await getCurrentTenant();
    if (!tenant) throw new Error("No tenant resolved.");
    const tenantId = tenant.id;
    const { fields, files } = splitAdmissionInput(input, ADMIT_FIELDS);
    const data = admitStudentSchema.parse(fields);

    const division = await loadDivisionWithSeats(tenantId, data.divisionId, data.courseId);
    if (!division) return { ok: false, error: "That division doesn't belong to the selected course." };
    if (division.capacity != null && division._count.students >= division.capacity) {
      return { ok: false, error: `${division.name} is at capacity (${division.capacity}). Choose another division.` };
    }

    const { structure: feeStructure, note: feeNote } = await loadFeeStructure(tenantId, data.courseId);
    const kycFiles = await storeKycUploads(tenantId, files);

    const result = await withEnrollmentRetry(() =>
      prisma.$transaction(async (tx) => {
        const enrolled = await enrollStudent(tx, {
          tenantId,
          tenantSubdomain: tenant.subdomain,
          actorId: session.user.id,
          person: { name: data.name, phone: data.phone, email: data.email || null, dob: data.dob, address: data.address },
          courseId: data.courseId,
          divisionId: data.divisionId,
          guardian: {
            name: data.guardianName,
            phone: data.guardianPhone,
            email: data.guardianEmail,
            relationship: data.guardianRelationship,
          },
          requiredKycDocs: tenant.requiredKycDocs,
          kycFiles,
          feeStructure,
        });

        await writeAuditLog(tx, {
          tenantId,
          actorId: session.user.id,
          action: "ADMIT",
          entityType: "Student",
          entityId: enrolled.studentId,
          diff: { enrollmentNumber: enrolled.enrollmentNumber, courseId: data.courseId, divisionId: data.divisionId, walkIn: true },
        });

        return enrolled;
      }),
    );

    revalidatePath("/admissions/students");
    revalidatePath("/admissions/queue");
    revalidatePath("/admissions/kyc");
    revalidatePath("/admin/divisions");

    return { ok: true, data: feeNote ? { ...result, notes: [...result.notes, feeNote] } : result };
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadKycDocument(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requirePermission("kyc:manage");
    const tenantId = await getTenantId();

    const studentId = String(formData.get("studentId") ?? "");
    const kycDocumentId = String(formData.get("kycDocumentId") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload." };
    const problem = kycFileProblem(file);
    if (problem) return { ok: false, error: problem };

    const doc = await prisma.kycDocument.findFirstOrThrow({ where: { id: kycDocumentId, tenantId, studentId } });

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storage.save({
      tenantId,
      category: "kyc",
      buffer,
      filename: file.name,
      contentType: file.type,
    });

    await prisma.$transaction(async (tx) => {
      await tx.kycDocument.update({
        where: { id: doc.id },
        data: { fileUrl: stored.url, status: "SUBMITTED", verifiedById: null, verifiedAt: null },
      });
      if (doc.docType === "PHOTO") {
        await tx.student.update({ where: { id: studentId }, data: { photoUrl: stored.url } });
      }
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPLOAD",
        entityType: "KycDocument",
        entityId: doc.id,
        diff: { docType: doc.docType, replaced: doc.fileUrl != null },
      });
    });

    // The superseded file has no row pointing at it any more; don't keep it.
    if (doc.fileUrl && doc.fileUrl !== stored.url) await storage.delete(doc.fileUrl).catch(() => {});

    revalidatePath(`/admissions/students/${studentId}`);
    revalidatePath("/admissions/kyc");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function setKycStatus(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("kyc:manage");
    const tenantId = await getTenantId();
    const data = kycStatusSchema.parse(input);

    const doc = await prisma.kycDocument.findFirstOrThrow({ where: { id: data.kycDocumentId, tenantId } });

    await prisma.$transaction(async (tx) => {
      await tx.kycDocument.update({
        where: { id: doc.id },
        data: { status: data.status, verifiedById: session.user.id, verifiedAt: new Date() },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: data.status === "VERIFIED" ? "VERIFY" : "REJECT",
        entityType: "KycDocument",
        entityId: doc.id,
        diff: { docType: doc.docType },
      });

      const remainingRequired = await tx.kycDocument.count({
        where: { tenantId, studentId: doc.studentId, required: true, status: { not: "VERIFIED" } },
      });
      if (remainingRequired === 0) {
        await tx.student.update({ where: { id: doc.studentId }, data: { status: "ACTIVE" } });
      }
    });

    revalidatePath(`/admissions/students/${doc.studentId}`);
    revalidatePath("/admissions/queue");
    revalidatePath("/admissions/kyc");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateStudentProfile(studentId: string, input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("student:manage");
    const tenantId = await getTenantId();
    const data = studentProfileSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const before = await tx.student.findFirstOrThrow({ where: { id: studentId, tenantId } });
      await tx.student.update({
        where: { id: studentId },
        data: {
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          dob: data.dob ? new Date(data.dob) : null,
          address: data.address || null,
        },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "Student",
        entityId: studentId,
        diff: { before: { name: before.name, phone: before.phone, email: before.email }, after: data },
      });
    });

    revalidatePath(`/admissions/students/${studentId}`);
    revalidatePath("/admissions/students");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Moves a student to a different division. Closes out the current
 * Enrollment row (endDate) and opens a new one rather than mutating
 * history in place — attendance/assignment records keep the divisionId
 * they were created with, so past records stay attributed to the division
 * they actually happened in. See PRD §6.1: "reassigning a student between
 * divisions must preserve their attendance/assignment history."
 */
export async function reassignStudentDivision(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("student:manage");
    const tenantId = await getTenantId();
    const data = reassignDivisionSchema.parse(input);

    const student = await prisma.student.findFirstOrThrow({ where: { id: data.studentId, tenantId } });
    if (student.divisionId === data.divisionId) {
      return { ok: false, error: "Student is already in that division." };
    }

    const targetDivision = await prisma.division.findFirstOrThrow({
      where: { id: data.divisionId, tenantId },
      include: { _count: { select: { students: { where: ENROLLED_STUDENT_WHERE } } } },
    });
    if (targetDivision.capacity != null && targetDivision._count.students >= targetDivision.capacity) {
      return { ok: false, error: `${targetDivision.name} is at capacity (${targetDivision.capacity}).` };
    }

    await prisma.$transaction(async (tx) => {
      const openEnrollment = await tx.enrollment.findFirst({
        where: { tenantId, studentId: student.id, endDate: null },
        orderBy: { startDate: "desc" },
      });
      if (openEnrollment) {
        await tx.enrollment.update({ where: { id: openEnrollment.id }, data: { endDate: new Date() } });
      }

      await tx.enrollment.create({
        data: {
          tenantId,
          studentId: student.id,
          divisionId: data.divisionId,
          reason: data.reason || null,
          recordedById: session.user.id,
        },
      });

      await tx.student.update({ where: { id: student.id }, data: { divisionId: data.divisionId } });

      // Work already set for the new division is now theirs too; their old
      // division's rows stay, so history is kept (PRD §6.1).
      await syncSubmissionsForStudent(tx, tenantId, student.id, data.divisionId);

      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "REASSIGN_DIVISION",
        entityType: "Student",
        entityId: student.id,
        diff: { fromDivisionId: student.divisionId, toDivisionId: data.divisionId, reason: data.reason },
      });
    });

    revalidatePath(`/admissions/students/${student.id}`);
    revalidatePath("/admin/divisions");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function setStudentStatus(studentId: string, status: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission("student:manage");
    const tenantId = await getTenantId();
    const next = studentStatusSchema.parse(status);

    await prisma.$transaction(async (tx) => {
      const student = await tx.student.findFirstOrThrow({ where: { id: studentId, tenantId } });
      if (student.status === next) return;

      await tx.student.update({ where: { id: student.id }, data: { status: next } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE_STATUS",
        entityType: "Student",
        entityId: student.id,
        diff: { name: student.name, from: student.status, to: next },
      });
    });

    revalidatePath("/admissions/students");
    revalidatePath(`/admissions/students/${studentId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteStudent(studentId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("student:delete");
    const tenantId = await getTenantId();

    const student = await prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: { _count: { select: { payments: true } } },
    });
    if (!student) return { ok: false, error: "Student not found." };

    // Financial history is append-only and must stay auditable, so a student
    // who has ever paid can only be deactivated (PRD §6.2).
    if (student._count.payments > 0) {
      return {
        ok: false,
        error: `${student.name} has ${student._count.payments} payment entr${student._count.payments === 1 ? "y" : "ies"}. Financial records can't be deleted — set the student to Inactive instead.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.student.delete({ where: { id: student.id } });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "DELETE",
        entityType: "Student",
        entityId: student.id,
        diff: { name: student.name, enrollmentNumber: student.enrollmentNumber },
      });
    });

    revalidatePath("/admissions/students");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Guardian details were fixed at admission with no way to correct a typo or
 * a changed number. The linked portal account follows: name and phone always,
 * the sign-in email only when the new address isn't already someone's login.
 */
export async function updateGuardian(guardianId: string, input: unknown): Promise<ActionResult<{ notes: string[] }>> {
  try {
    const session = await requirePermission("student:manage");
    const tenantId = await getTenantId();
    const data = guardianProfileSchema.parse(input);
    const email = normalizeEmail(data.email);
    const notes: string[] = [];

    await prisma.$transaction(async (tx) => {
      const before = await tx.parentGuardian.findFirstOrThrow({ where: { id: guardianId, tenantId }, include: { user: true } });

      await tx.parentGuardian.update({
        where: { id: before.id },
        data: { name: data.name, phone: data.phone, email, relationship: data.relationship || null },
      });

      if (before.user) {
        let loginEmail = before.user.email;
        if (email && email !== before.user.email) {
          const taken = await tx.user.findUnique({ where: { tenantId_email: { tenantId, email } }, select: { id: true } });
          if (taken) notes.push("That email is already another account's login, so the portal login address was left unchanged.");
          else loginEmail = email;
        }
        await tx.user.update({
          where: { id: before.user.id },
          data: { name: data.name, phone: data.phone, email: loginEmail },
        });
      }

      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "ParentGuardian",
        entityId: before.id,
        diff: { before: { name: before.name, phone: before.phone, email: before.email }, after: { ...data, email } },
      });
    });

    revalidatePath("/admissions/students");
    revalidatePath("/admissions/invites");
    return { ok: true, data: { notes } };
  } catch (error) {
    return actionError(error);
  }
}

export type GuardianInviteResult = { email: string; password: string };

export async function sendGuardianInvite(guardianId: string): Promise<ActionResult<GuardianInviteResult>> {
  try {
    const session = await requirePermission("student:manage");
    const tenantId = await getTenantId();

    const guardian = await prisma.parentGuardian.findFirst({
      where: { id: guardianId, tenantId },
      include: { user: true },
    });
    if (!guardian || !guardian.user) {
      return { ok: false, error: "This guardian has no portal account." };
    }

    const password = generateTempPassword();
    const passwordHash = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: guardian.user!.id },
        data: { passwordHash, lastInviteSentAt: new Date() },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "SEND_INVITE",
        entityType: "ParentGuardian",
        entityId: guardian.id,
        diff: { email: guardian.user!.email },
      });
    });

    revalidatePath("/admissions/invites");
    return { ok: true, data: { email: guardian.user.email, password } };
  } catch (error) {
    return actionError(error);
  }
}
