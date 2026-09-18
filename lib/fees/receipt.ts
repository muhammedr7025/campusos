import "server-only";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";

export type ReceiptData = {
  paymentId: string;
  receiptNumber: string;
  isCorrection: boolean;
  correctionOfReceipt: string | null;
  correctedByReceipt: string | null;
  institute: { name: string; logoUrl: string | null };
  student: { id: string; name: string; enrollmentNumber: string; courseName: string; divisionName: string | null };
  guardianName: string | null;
  installmentLabel: string | null;
  planName: string;
  amount: number;
  mode: string;
  paidAt: Date;
  collectedBy: string;
  note: string | null;
  /** The plan's total, what had been paid including this receipt, and what was still owed after it. */
  planTotal: number;
  paidToDate: number;
  balanceAfter: number;
  issuedAt: Date;
};

/** Display fallback for rows that predate receipt numbering. */
export function receiptLabel(payment: { receiptNumber: string | null; id: string }): string {
  return payment.receiptNumber ?? payment.id.slice(-8).toUpperCase();
}

/**
 * Everything a printed receipt shows, assembled from the ledger. The balance
 * line is "as of this receipt" — payments logged afterwards don't rewrite a
 * receipt already handed to a parent.
 */
export async function getReceipt(tenantId: string, paymentId: string): Promise<ReceiptData | null> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId },
    include: {
      tenant: { select: { name: true, logoUrl: true } },
      student: {
        select: {
          id: true,
          name: true,
          enrollmentNumber: true,
          course: { select: { name: true } },
          division: { select: { name: true } },
          guardians: { where: { isPrimary: true }, take: 1, select: { guardian: { select: { name: true } } } },
        },
      },
      feePlan: { select: { totalAmount: true, feeStructure: { select: { name: true } }, overrideReason: true } },
      installment: { select: { label: true } },
      collectedBy: { select: { name: true } },
      correctionOf: { select: { receiptNumber: true, id: true } },
      corrections: { select: { receiptNumber: true, id: true }, take: 1 },
    },
  });
  if (!payment) return null;

  // Every payment up to and including this one, in ledger order.
  const priorRows = await prisma.payment.findMany({
    where: {
      tenantId,
      studentId: payment.studentId,
      OR: [{ paidAt: { lt: payment.paidAt } }, { paidAt: payment.paidAt, createdAt: { lte: payment.createdAt } }],
    },
    select: { amount: true },
  });
  const paidToDate = priorRows.reduce((sum, p) => sum + Number(p.amount), 0);
  const planTotal = Number(payment.feePlan.totalAmount);

  return {
    paymentId: payment.id,
    receiptNumber: receiptLabel(payment),
    isCorrection: payment.correctionOfId != null,
    correctionOfReceipt: payment.correctionOf ? receiptLabel(payment.correctionOf) : null,
    correctedByReceipt: payment.corrections[0] ? receiptLabel(payment.corrections[0]) : null,
    institute: { name: payment.tenant.name, logoUrl: payment.tenant.logoUrl },
    student: {
      id: payment.student.id,
      name: payment.student.name,
      enrollmentNumber: payment.student.enrollmentNumber,
      courseName: payment.student.course.name,
      divisionName: payment.student.division?.name ?? null,
    },
    guardianName: payment.student.guardians[0]?.guardian.name ?? null,
    installmentLabel: payment.installment?.label ?? null,
    planName: payment.feePlan.feeStructure?.name ?? (payment.feePlan.overrideReason ? "Custom fee plan" : "Fee plan"),
    amount: Number(payment.amount),
    mode: payment.mode,
    paidAt: payment.paidAt,
    collectedBy: payment.collectedBy.name,
    note: payment.note,
    planTotal,
    paidToDate,
    balanceAfter: Math.max(planTotal - paidToDate, 0),
    issuedAt: payment.createdAt,
  };
}

/**
 * Who may open a receipt: finance and admin for anyone in the institute; a
 * student for their own; a parent for their children's.
 */
export async function canViewReceipt(
  tenantId: string,
  viewer: { id: string; role: Role },
  studentId: string,
): Promise<boolean> {
  if (viewer.role === Role.SUPER_ADMIN || viewer.role === Role.FINANCE) return true;
  if (viewer.role === Role.STUDENT) {
    const own = await prisma.student.findFirst({ where: { tenantId, id: studentId, userId: viewer.id }, select: { id: true } });
    return own != null;
  }
  if (viewer.role === Role.PARENT) {
    const link = await prisma.studentGuardian.findFirst({
      where: { studentId, guardian: { tenantId, userId: viewer.id } },
      select: { id: true },
    });
    return link != null;
  }
  return false;
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(ONES[n % 10] ? `${TENS[Math.floor(n / 10)]}-${ONES[n % 10]}` : TENS[Math.floor(n / 10)]);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

/** "Rupees twelve thousand five hundred only" — the line every Indian fee receipt carries. */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Rupees zero only";

  const parts: string[] = [];
  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1000);
  const rest = rupees % 1000;
  if (crore) parts.push(`${belowThousand(crore)} crore`);
  if (lakh) parts.push(`${belowThousand(lakh)} lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} thousand`);
  if (rest) parts.push(belowThousand(rest));

  let words = `Rupees ${parts.join(" ")}`.trim();
  if (paise) words += ` and ${belowThousand(paise)} paise`;
  words = `${amount < 0 ? "Minus " : ""}${words} only`;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
