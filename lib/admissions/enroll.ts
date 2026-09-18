import "server-only";
import { Prisma, Role, type KycDocType } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { generateTempPassword, hashPassword } from "@/lib/auth-helpers";
import { STANDARD_KYC_DOCS } from "@/lib/admissions/kyc-files";
import { syncSubmissionsForStudent } from "@/lib/academics/submissions";

type Tx = Prisma.TransactionClient;

/**
 * Everything a walk-in admission and a lead conversion have in common — which
 * is everything after "who is this person": portal logins, the guardian link,
 * the enrollment row, the KYC checklist, the fee plan and the audit trail. The
 * two actions used to carry a copy each, and a fix landing in one of them was
 * a bug left in the other.
 */
export type EnrollStudentInput = {
  tenantId: string;
  tenantSubdomain: string;
  actorId: string;
  person: {
    name: string;
    phone: string;
    email: string | null;
    dob: string | null | undefined;
    address: string | null | undefined;
  };
  courseId: string;
  divisionId: string;
  guardian: {
    name: string;
    phone: string;
    email: string | null | undefined;
    relationship: string | null | undefined;
  };
  convertedFromLeadId?: string;
  /** The institute's mandatory documents; the other standard ones are optional. */
  requiredKycDocs: KycDocType[];
  /** Already-stored KYC files, by document type. */
  kycFiles: Partial<Record<KycDocType, { url: string }>>;
  feeStructure: {
    id: string;
    totalAmount: Prisma.Decimal;
    installments: { label: string; amount: Prisma.Decimal; dueDate: Date; sequence: number }[];
  } | null;
};

export type EnrollStudentResult = {
  studentId: string;
  enrollmentNumber: string;
  studentLogin: { email: string; password: string };
  guardianLogin: { email: string; password: string } | null;
  /** Anything the officer should know that isn't a failure — a substituted login, say. */
  notes: string[];
};

/** Login lookups lowercase the address, so every stored one must be lowercase too. */
export function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase() ?? "";
  return trimmed === "" ? null : trimmed;
}

const digitsOf = (value: string) => value.replace(/\D/g, "");

/**
 * Next enrollment number for the year, e.g. 2026-0007. Taken from the highest
 * number already issued this year rather than a row count: a count re-issues
 * a deleted student's number, which then collides with the next one forever
 * — every retry computes the same count and the same number.
 */
export async function nextEnrollmentNumber(tx: Tx, tenantId: string, year = new Date().getFullYear()): Promise<string> {
  const prefix = `${year}-`;
  const issued = await tx.student.findMany({
    where: { tenantId, enrollmentNumber: { startsWith: prefix } },
    select: { enrollmentNumber: true },
  });
  const highest = issued.reduce((max, s) => {
    const n = Number.parseInt(s.enrollmentNumber.slice(prefix.length), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

/** True when a P2002 came from the (tenantId, enrollmentNumber) index — the one worth retrying. */
export function isEnrollmentNumberClash(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  return Array.isArray(target) ? target.includes("enrollmentNumber") : String(target ?? "").includes("enrollmentNumber");
}

/**
 * Siblings share a parent — reuse an existing guardian instead of creating a
 * duplicate (PRD §8: Student <-> Parent is many-to-many). Phone numbers are
 * compared by their digits, so "+91 90000 22222" and "9000022222" are the
 * same parent.
 */
async function findGuardianByPhone(tx: Tx, tenantId: string, phone: string) {
  const exact = await tx.parentGuardian.findFirst({ where: { tenantId, phone } });
  if (exact) return exact;

  const digits = digitsOf(phone);
  if (digits.length < 6) return null;
  const tail = digits.slice(-Math.min(10, digits.length));
  const candidates = await tx.parentGuardian.findMany({
    where: { tenantId, phone: { contains: tail.slice(-4) } },
  });
  return candidates.find((g) => digitsOf(g.phone).endsWith(tail)) ?? null;
}

async function findStudentsByPhone(tx: Tx, tenantId: string, phone: string, excludeId: string) {
  const digits = digitsOf(phone);
  if (digits.length < 6) return [];
  const tail = digits.slice(-Math.min(10, digits.length));
  const candidates = await tx.student.findMany({
    where: { tenantId, id: { not: excludeId }, phone: { contains: tail.slice(-4) } },
    select: { name: true, enrollmentNumber: true, phone: true },
  });
  return candidates.filter((s) => digitsOf(s.phone ?? "").endsWith(tail));
}

/**
 * The address a new portal user signs in with. The person's own email when
 * it's free; otherwise a generated one, because (tenantId, email) is unique
 * and a parent very often puts their own email on the child's enquiry — so
 * the student's "email" and the guardian's are the same address and the
 * second account can't be created with it.
 */
async function chooseLoginEmail(
  tx: Tx,
  tenantId: string,
  preferred: string | null,
  fallback: string,
  alsoTaken: Set<string>,
): Promise<{ email: string; substituted: boolean }> {
  if (!preferred) return { email: fallback, substituted: false };
  if (alsoTaken.has(preferred)) return { email: fallback, substituted: true };
  const existing = await tx.user.findUnique({
    where: { tenantId_email: { tenantId, email: preferred } },
    select: { id: true },
  });
  return existing ? { email: fallback, substituted: true } : { email: preferred, substituted: false };
}

export async function enrollStudent(tx: Tx, input: EnrollStudentInput): Promise<EnrollStudentResult> {
  const { tenantId, actorId } = input;
  const notes: string[] = [];
  const enrollmentNumber = await nextEnrollmentNumber(tx, tenantId);
  const claimedEmails = new Set<string>();

  let guardian = await findGuardianByPhone(tx, tenantId, input.guardian.phone);
  let guardianLogin: EnrollStudentResult["guardianLogin"] = null;

  if (!guardian) {
    const chosen = await chooseLoginEmail(
      tx,
      tenantId,
      normalizeEmail(input.guardian.email),
      `${enrollmentNumber}.parent@guardian.${input.tenantSubdomain}`,
      claimedEmails,
    );
    if (chosen.substituted) {
      notes.push("The guardian's email already belongs to another account here, so their portal login uses a generated address.");
    }
    claimedEmails.add(chosen.email);

    const guardianPassword = generateTempPassword();
    const guardianUser = await tx.user.create({
      data: {
        tenantId,
        email: chosen.email,
        passwordHash: await hashPassword(guardianPassword),
        name: input.guardian.name,
        phone: input.guardian.phone,
        role: Role.PARENT,
        // The credentials are handed over at the desk right now — that's the
        // invite (there's no SMS/email provider), so the invites page shows
        // "awaiting first login" rather than "not invited".
        lastInviteSentAt: new Date(),
      },
    });
    guardian = await tx.parentGuardian.create({
      data: {
        tenantId,
        name: input.guardian.name,
        phone: input.guardian.phone,
        email: normalizeEmail(input.guardian.email),
        relationship: input.guardian.relationship || null,
        userId: guardianUser.id,
      },
    });
    guardianLogin = { email: chosen.email, password: guardianPassword };
  }

  const studentChosen = await chooseLoginEmail(
    tx,
    tenantId,
    normalizeEmail(input.person.email),
    `${enrollmentNumber}@student.${input.tenantSubdomain}`,
    claimedEmails,
  );
  if (studentChosen.substituted) {
    notes.push("The student's email is already used by another account (often the parent's), so their portal login uses a generated address.");
  }

  const studentPassword = generateTempPassword();
  const studentUser = await tx.user.create({
    data: {
      tenantId,
      email: studentChosen.email,
      passwordHash: await hashPassword(studentPassword),
      name: input.person.name,
      phone: input.person.phone,
      role: Role.STUDENT,
    },
  });

  const student = await tx.student.create({
    data: {
      tenantId,
      convertedFromLeadId: input.convertedFromLeadId ?? null,
      enrollmentNumber,
      name: input.person.name,
      phone: input.person.phone,
      email: normalizeEmail(input.person.email),
      dob: input.person.dob ? new Date(input.person.dob) : null,
      address: input.person.address || null,
      // The KYC photo doubles as the profile photo — it's the same picture.
      photoUrl: input.kycFiles.PHOTO?.url ?? null,
      courseId: input.courseId,
      divisionId: input.divisionId,
      userId: studentUser.id,
      // With nothing mandatory there's nothing to wait for.
      status: input.requiredKycDocs.length === 0 ? "ACTIVE" : "KYC_PENDING",
    },
  });

  // Anyone else on the books with this number is worth a second look —
  // usually a sibling's record reusing a parent's phone, occasionally the
  // same person admitted twice.
  const sameNumber = await findStudentsByPhone(tx, tenantId, input.person.phone, student.id);
  if (sameNumber.length > 0) {
    notes.push(
      `${sameNumber.map((s) => `${s.name} (${s.enrollmentNumber})`).join(", ")} ${sameNumber.length === 1 ? "has" : "have"} the same phone number — check this isn't a duplicate admission.`,
    );
  }

  await tx.studentGuardian.create({
    data: { studentId: student.id, guardianId: guardian.id, isPrimary: true },
  });

  await tx.enrollment.create({
    data: { tenantId, studentId: student.id, divisionId: input.divisionId, recordedById: actorId },
  });

  // Assignments already posted to this division apply to the newcomer too.
  await syncSubmissionsForStudent(tx, tenantId, student.id, input.divisionId);

  // One checklist row per standard document. A file handed over at the desk
  // is recorded as submitted straight away; the rest wait for the tracker.
  for (const docType of STANDARD_KYC_DOCS) {
    const stored = input.kycFiles[docType];
    const doc = await tx.kycDocument.create({
      data: {
        tenantId,
        studentId: student.id,
        docType,
        required: input.requiredKycDocs.includes(docType),
        fileUrl: stored?.url ?? null,
        status: stored ? "SUBMITTED" : "PENDING",
      },
    });
    if (stored) {
      await writeAuditLog(tx, {
        tenantId,
        actorId,
        action: "UPLOAD",
        entityType: "KycDocument",
        entityId: doc.id,
        diff: { docType, atAdmission: true },
      });
    }
  }

  if (input.feeStructure) {
    await tx.feePlan.create({
      data: {
        tenantId,
        studentId: student.id,
        feeStructureId: input.feeStructure.id,
        totalAmount: input.feeStructure.totalAmount,
        installments: {
          create: input.feeStructure.installments.map((i) => ({
            label: i.label,
            amount: i.amount,
            dueDate: i.dueDate,
            sequence: i.sequence,
          })),
        },
      },
    });
  }

  return {
    studentId: student.id,
    enrollmentNumber,
    studentLogin: { email: studentChosen.email, password: studentPassword },
    guardianLogin,
    notes,
  };
}
