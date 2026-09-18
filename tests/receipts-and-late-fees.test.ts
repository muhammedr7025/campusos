import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { logPayment } from "@/lib/actions/finance";
import { amountInWords, canViewReceipt, getReceipt } from "@/lib/fees/receipt";
import { computeLateFee, getCurrentFeePlanForStudent, getFeeSummaryForTenant } from "@/lib/fees/balance";
import { canReadStoredFile } from "@/lib/storage/access";

let f: Fixture;

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
});

const DAY = 86_400_000;

/** A student with a portal login and a guardian with one, on a 3 × 20,000 plan. */
async function familyWithPlan(opts: { dueDates?: Date[]; lateFee?: { type: "FLAT" | "PERCENT"; value: number; grace: number } | null } = {}) {
  if (opts.lateFee !== undefined) {
    await prisma.feeStructure.update({
      where: { id: f.feeStructure.id },
      data: opts.lateFee
        ? { lateFeeType: opts.lateFee.type, lateFeeValue: opts.lateFee.value, gracePeriodDays: opts.lateFee.grace }
        : { lateFeeType: null, lateFeeValue: null },
    });
  }
  const studentUser = await prisma.user.create({
    data: { tenantId: f.tenant.id, email: `kid${Math.random()}@t.local`, name: "Kid", passwordHash: "x", role: "STUDENT" },
  });
  const parentUser = await prisma.user.create({
    data: { tenantId: f.tenant.id, email: `parent${Math.random()}@t.local`, name: "Parent", passwordHash: "x", role: "PARENT" },
  });
  const student = await createStudent(f, { name: "Ishaan Rao" });
  await prisma.student.update({ where: { id: student.id }, data: { userId: studentUser.id } });
  const guardian = await prisma.parentGuardian.create({
    data: { tenantId: f.tenant.id, name: "Meena Rao", phone: "9000000001", userId: parentUser.id },
  });
  await prisma.studentGuardian.create({ data: { studentId: student.id, guardianId: guardian.id, isPrimary: true } });

  const dueDates = opts.dueDates ?? [0, 1, 2].map((i) => new Date(Date.now() + (i + 30) * DAY));
  const plan = await prisma.feePlan.create({
    data: {
      tenantId: f.tenant.id,
      studentId: student.id,
      feeStructureId: f.feeStructure.id,
      totalAmount: 60000,
      installments: {
        create: dueDates.map((d, i) => ({ label: `Installment ${i + 1}`, amount: 20000, sequence: i + 1, dueDate: d })),
      },
    },
    include: { installments: { orderBy: { sequence: "asc" } } },
  });
  return { student, studentUser, parentUser, plan };
}

describe("receipts", () => {
  it("logging a payment returns its receipt, ready to print", async () => {
    const { student, plan } = await familyWithPlan();
    setTestActor({ id: f.finance.id, role: "FINANCE" });

    const result = await logPayment({ studentId: student.id, feePlanId: plan.id, installmentId: plan.installments[0].id, amount: 20000, mode: "UPI", paidAt: "2026-09-01" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.receiptNumber).toBe("RCP-0001");
    const receipt = await getReceipt(f.tenant.id, result.data.paymentId);
    expect(receipt).not.toBeNull();
    expect(receipt!.receiptNumber).toBe("RCP-0001");
    expect(receipt!.student.name).toBe("Ishaan Rao");
    expect(receipt!.guardianName).toBe("Meena Rao");
    expect(receipt!.installmentLabel).toBe("Installment 1");
    expect(receipt!.amount).toBe(20000);
    expect(receipt!.planTotal).toBe(60000);
    expect(receipt!.paidToDate).toBe(20000);
    expect(receipt!.balanceAfter).toBe(40000);
    expect(receipt!.institute.name).toBe("Test Institute");
  });

  it("keeps each receipt's balance as it stood when it was issued", async () => {
    const { student, plan } = await familyWithPlan();
    setTestActor({ id: f.finance.id, role: "FINANCE" });
    const first = await logPayment({ studentId: student.id, feePlanId: plan.id, amount: 20000, mode: "CASH", paidAt: "2026-09-01" });
    await logPayment({ studentId: student.id, feePlanId: plan.id, amount: 15000, mode: "CASH", paidAt: "2026-09-05" });
    if (!first.ok) throw new Error(first.error);

    const receipt = await getReceipt(f.tenant.id, first.data.paymentId);

    // A later payment doesn't rewrite a receipt already handed over.
    expect(receipt!.balanceAfter).toBe(40000);
  });

  it("tells the student and guardian, pointing at the receipt", async () => {
    const { student, studentUser, parentUser, plan } = await familyWithPlan();
    setTestActor({ id: f.finance.id, role: "FINANCE" });

    const result = await logPayment({ studentId: student.id, feePlanId: plan.id, amount: 5000, mode: "UPI", paidAt: "2026-09-01" });
    if (!result.ok) throw new Error(result.error);

    const notes = await prisma.notification.findMany({ where: { type: "PAYMENT_RECEIVED" } });
    expect(notes.map((n) => n.recipientId).sort()).toEqual([studentUser.id, parentUser.id].sort());
    expect(notes[0].relatedEntityType).toBe("Payment");
    expect(notes[0].relatedEntityId).toBe(result.data.paymentId);
    expect(notes[0].title).toContain("RCP-0001");
  });

  it("numbers past RCP-9999 in numeric order, not text order", async () => {
    const { student, plan } = await familyWithPlan();
    for (const n of ["RCP-9999", "RCP-10000"]) {
      await prisma.payment.create({
        data: { tenantId: f.tenant.id, studentId: student.id, feePlanId: plan.id, amount: 1, mode: "CASH", paidAt: new Date(), collectedById: f.finance.id, receiptNumber: n },
      });
    }
    setTestActor({ id: f.finance.id, role: "FINANCE" });

    const result = await logPayment({ studentId: student.id, feePlanId: plan.id, amount: 100, mode: "CASH", paidAt: "2026-09-01" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.receiptNumber).toBe("RCP-10001");
  });

  it("is visible to finance, the student and their guardian — and nobody else", async () => {
    const { student, studentUser, parentUser } = await familyWithPlan();
    const strangerParent = await prisma.user.create({
      data: { tenantId: f.tenant.id, email: "stranger@t.local", name: "Stranger", passwordHash: "x", role: "PARENT" },
    });
    await prisma.parentGuardian.create({ data: { tenantId: f.tenant.id, name: "Stranger", phone: "9111111111", userId: strangerParent.id } });

    expect(await canViewReceipt(f.tenant.id, { id: f.finance.id, role: "FINANCE" }, student.id)).toBe(true);
    expect(await canViewReceipt(f.tenant.id, { id: f.admin.id, role: "SUPER_ADMIN" }, student.id)).toBe(true);
    expect(await canViewReceipt(f.tenant.id, { id: studentUser.id, role: "STUDENT" }, student.id)).toBe(true);
    expect(await canViewReceipt(f.tenant.id, { id: parentUser.id, role: "PARENT" }, student.id)).toBe(true);
    expect(await canViewReceipt(f.tenant.id, { id: strangerParent.id, role: "PARENT" }, student.id)).toBe(false);
    expect(await canViewReceipt(f.tenant.id, { id: f.teacher.id, role: "TEACHER" }, student.id)).toBe(false);
  });

  it("writes the amount in words the Indian way", () => {
    expect(amountInWords(20000)).toBe("Rupees twenty thousand only");
    expect(amountInWords(125050)).toBe("Rupees one lakh twenty-five thousand fifty only");
    expect(amountInWords(12345678.5)).toBe("Rupees one crore twenty-three lakh forty-five thousand six hundred seventy-eight and fifty paise only");
  });
});

describe("late fees", () => {
  const inst = (daysAgo: number, seq: number) => ({ amount: 20000, sequence: seq, dueDate: new Date(Date.now() - daysAgo * DAY) });

  it("charges a flat fee per installment overdue past the grace period", () => {
    const fee = computeLateFee([inst(30, 1), inst(10, 2), inst(-10, 3)], 0, { lateFeeType: "FLAT", lateFeeValue: 500, gracePeriodDays: 7 });
    expect(fee).toBe(1000);
  });

  it("waits out the grace period", () => {
    const fee = computeLateFee([inst(5, 1)], 0, { lateFeeType: "FLAT", lateFeeValue: 500, gracePeriodDays: 7 });
    expect(fee).toBe(0);
  });

  it("charges a percentage of only the unpaid part", () => {
    // 25,000 paid covers installment 1 and 5,000 of installment 2.
    const fee = computeLateFee([inst(30, 1), inst(20, 2)], 25000, { lateFeeType: "PERCENT", lateFeeValue: 2, gracePeriodDays: 0 });
    expect(fee).toBe(300);
  });

  it("charges nothing without a rule", () => {
    expect(computeLateFee([inst(30, 1)], 0, null)).toBe(0);
    expect(computeLateFee([inst(30, 1)], 0, { lateFeeType: null, lateFeeValue: null, gracePeriodDays: 0 })).toBe(0);
  });

  it("shows on the dues summary and lets the desk collect it", async () => {
    const past = [40, 20, -20].map((d) => new Date(Date.now() - d * DAY));
    const { student, plan } = await familyWithPlan({ dueDates: past, lateFee: { type: "FLAT", value: 500, grace: 7 } });

    const [summary] = await getFeeSummaryForTenant(f.tenant.id);
    expect(summary.balance).toBe(60000);
    expect(summary.lateFee).toBe(1000);
    expect(summary.totalDue).toBe(61000);

    setTestActor({ id: f.finance.id, role: "FINANCE" });
    const over = await logPayment({ studentId: student.id, feePlanId: plan.id, amount: 61001, mode: "CASH", paidAt: "2026-09-01" });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toContain("late fee");
    const exact = await logPayment({ studentId: student.id, feePlanId: plan.id, amount: 61000, mode: "CASH", paidAt: "2026-09-01" });
    expect(exact.ok).toBe(true);
  });
});

describe("the notes lock", () => {
  async function noteFor(courseId: string) {
    return prisma.subjectNote.create({
      data: { tenantId: f.tenant.id, courseId, subjectId: f.subject.id, title: "Kinematics", fileUrl: `/api/storage/${f.tenant.id}/notes/a.pdf`, authorId: f.teacher.id },
    });
  }

  it("stays open while the balance isn't due yet", async () => {
    const { studentUser } = await familyWithPlan({ lateFee: null });
    const note = await noteFor(f.course.id);

    const allowed = await canReadStoredFile({ tenantId: f.tenant.id, category: "notes", url: note.fileUrl!, viewer: { id: studentUser.id, role: "STUDENT" } });

    expect(allowed).toBe(true);
    const detail = await getCurrentFeePlanForStudent(f.tenant.id, (await prisma.student.findFirstOrThrow({ where: { userId: studentUser.id } })).id);
    expect(detail!.balance).toBe(60000);
    expect(detail!.isOverdue).toBe(false);
  });

  it("closes once an installment is overdue", async () => {
    const { studentUser } = await familyWithPlan({ dueDates: [new Date(Date.now() - 5 * DAY), new Date(Date.now() + 30 * DAY)], lateFee: null });
    const note = await noteFor(f.course.id);

    const allowed = await canReadStoredFile({ tenantId: f.tenant.id, category: "notes", url: note.fileUrl!, viewer: { id: studentUser.id, role: "STUDENT" } });

    expect(allowed).toBe(false);
  });
});
