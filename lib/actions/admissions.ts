"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac/guard";
import { writeAuditLog } from "@/lib/audit";
import { generateTempPassword, hashPassword } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import {
  convertLeadSchema,
  kycStatusSchema,
  studentProfileSchema,
  reassignDivisionSchema,
} from "@/lib/validators/admissions";
import { actionError, type ActionResult } from "@/lib/actions/types";
import { Role, type KycDocType } from "@/generated/prisma/client";

const REQUIRED_KYC_DOCS: KycDocType[] = ["ID_PROOF", "PHOTO", "ADDRESS_PROOF", "PREVIOUS_MARKSHEET"];

export type ConvertLeadResult = {
  studentId: string;
  enrollmentNumber: string;
  studentLogin: { email: string; password: string };
  guardianLogin: { email: string; password: string } | null;
};

export async function convertLead(input: unknown): Promise<ActionResult<ConvertLeadResult>> {
  try {
    const session = await requirePermission("lead:convert");
    const tenant = await getCurrentTenant();
    if (!tenant) throw new Error("No tenant resolved.");
    const tenantId = tenant.id;
    const data = convertLeadSchema.parse(input);

    const lead = await prisma.lead.findFirstOrThrow({ where: { id: data.leadId, tenantId } });
    if (lead.status === "CONVERTED") return { ok: false, error: "This lead has already been converted." };
    if (lead.status === "LOST") return { ok: false, error: "This lead is marked lost." };

    const division = await prisma.division.findFirstOrThrow({
      where: { id: data.divisionId, tenantId, courseId: data.courseId },
      include: { _count: { select: { students: true } } },
    });
    if (division.capacity != null && division._count.students >= division.capacity) {
      return { ok: false, error: `${division.name} is at capacity (${division.capacity}). Choose another division.` };
    }

    const feeStructure = await prisma.feeStructure.findFirst({
      where: { tenantId, courseId: data.courseId },
      include: { installments: { orderBy: { sequence: "asc" } } },
    });

    const year = new Date().getFullYear();
    const studentCount = await prisma.student.count({ where: { tenantId } });
    let enrollmentNumber = `${year}-${String(studentCount + 1).padStart(4, "0")}`;

    const studentPassword = generateTempPassword();
    const studentPasswordHash = await hashPassword(studentPassword);
    const studentLoginEmail = lead.email && lead.email.trim() !== "" ? lead.email : `${enrollmentNumber}@student.${tenant.subdomain}`;

    let guardianLogin: { email: string; password: string } | null = null;

    const result = await prisma.$transaction(async (tx) => {
      // Siblings share a parent — reuse an existing guardian by phone
      // instead of creating a duplicate (PRD §8: Student <-> Parent is
      // many-to-many).
      let guardian = await tx.parentGuardian.findFirst({ where: { tenantId, phone: data.guardianPhone } });

      if (!guardian) {
        const guardianPassword = generateTempPassword();
        const guardianPasswordHash = await hashPassword(guardianPassword);
        const guardianLoginEmail =
          data.guardianEmail && data.guardianEmail.trim() !== ""
            ? data.guardianEmail
            : `${enrollmentNumber}.parent@guardian.${tenant.subdomain}`;

        const guardianUser = await tx.user.create({
          data: {
            tenantId,
            email: guardianLoginEmail,
            passwordHash: guardianPasswordHash,
            name: data.guardianName,
            phone: data.guardianPhone,
            role: Role.PARENT,
          },
        });
        guardian = await tx.parentGuardian.create({
          data: {
            tenantId,
            name: data.guardianName,
            phone: data.guardianPhone,
            email: data.guardianEmail || null,
            relationship: data.guardianRelationship || null,
            userId: guardianUser.id,
          },
        });
        guardianLogin = { email: guardianLoginEmail, password: guardianPassword };
      }

      const studentUser = await tx.user.create({
        data: {
          tenantId,
          email: studentLoginEmail,
          passwordHash: studentPasswordHash,
          name: lead.name,
          phone: lead.phone,
          role: Role.STUDENT,
        },
      });

      let student;
      try {
        student = await tx.student.create({
          data: {
            tenantId,
            convertedFromLeadId: lead.id,
            enrollmentNumber,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            dob: data.dob ? new Date(data.dob) : null,
            address: data.address || null,
            courseId: data.courseId,
            divisionId: data.divisionId,
            userId: studentUser.id,
            status: "KYC_PENDING",
          },
        });
      } catch (err: unknown) {
        // Extremely unlikely race on the enrollment-number sequence; retry once with a suffix.
        if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
          enrollmentNumber = `${enrollmentNumber}-${Math.floor(Math.random() * 90 + 10)}`;
          student = await tx.student.create({
            data: {
              tenantId,
              convertedFromLeadId: lead.id,
              enrollmentNumber,
              name: lead.name,
              phone: lead.phone,
              email: lead.email,
              dob: data.dob ? new Date(data.dob) : null,
              address: data.address || null,
              courseId: data.courseId,
              divisionId: data.divisionId,
              userId: studentUser.id,
              status: "KYC_PENDING",
            },
          });
        } else {
          throw err;
        }
      }

      await tx.studentGuardian.create({
        data: { studentId: student.id, guardianId: guardian.id, isPrimary: true },
      });

      await tx.enrollment.create({
        data: { tenantId, studentId: student.id, divisionId: data.divisionId, recordedById: session.user.id },
      });

      await tx.kycDocument.createMany({
        data: REQUIRED_KYC_DOCS.map((docType) => ({
          tenantId,
          studentId: student.id,
          docType,
          required: true,
        })),
      });

      if (feeStructure) {
        await tx.feePlan.create({
          data: {
            tenantId,
            studentId: student.id,
            feeStructureId: feeStructure.id,
            totalAmount: feeStructure.totalAmount,
            installments: {
              create: feeStructure.installments.map((i) => ({
                label: i.label,
                amount: i.amount,
                dueDate: i.dueDate,
                sequence: i.sequence,
              })),
            },
          },
        });
      }

      await tx.lead.update({ where: { id: lead.id }, data: { status: "CONVERTED" } });

      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CONVERT",
        entityType: "Lead",
        entityId: lead.id,
        diff: { studentId: student.id, enrollmentNumber },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "CREATE",
        entityType: "Student",
        entityId: student.id,
        diff: { convertedFromLeadId: lead.id, courseId: data.courseId, divisionId: data.divisionId },
      });

      return student;
    });

    revalidatePath("/crm/leads");
    revalidatePath("/admissions/pending-kyc");
    revalidatePath("/admissions/students");

    return {
      ok: true,
      data: {
        studentId: result.id,
        enrollmentNumber,
        studentLogin: { email: studentLoginEmail, password: studentPassword },
        guardianLogin,
      },
    };
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
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return { ok: false, error: "Choose a file to upload." };

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
        data: { fileUrl: stored.url, status: "SUBMITTED" },
      });
      await writeAuditLog(tx, {
        tenantId,
        actorId: session.user.id,
        action: "UPLOAD",
        entityType: "KycDocument",
        entityId: doc.id,
        diff: { docType: doc.docType },
      });
    });

    revalidatePath(`/admissions/students/${studentId}`);
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
    revalidatePath("/admissions/pending-kyc");
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
      include: { _count: { select: { students: true } } },
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
