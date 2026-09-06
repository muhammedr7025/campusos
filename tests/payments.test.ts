import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { logPayment, correctPayment } from "@/lib/actions/finance";

let f: Fixture;
let studentId: string;
let feePlanId: string;
let installmentIds: string[];

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
  const student = await createStudent(f);
  studentId = student.id;
  const plan = await prisma.feePlan.create({
    data: {
      tenantId: f.tenant.id,
      studentId,
      feeStructureId: f.feeStructure.id,
      totalAmount: 60000,
      installments: {
        create: [1, 2, 3].map((n) => ({
          label: `Installment ${n}`,
          amount: 20000,
          sequence: n,
          dueDate: new Date(`2026-0${n}-15`),
        })),
      },
    },
    include: { installments: { orderBy: { sequence: "asc" } } },
  });
  feePlanId = plan.id;
  installmentIds = plan.installments.map((i) => i.id);
  setTestActor({ id: f.finance.id, role: "FINANCE" });
});

const pay = (over: Record<string, unknown> = {}) =>
  logPayment({
    studentId,
    feePlanId,
    installmentId: installmentIds[0],
    amount: 20000,
    mode: "UPI",
    paidAt: "2026-01-10",
    ...over,
  });

describe("receipt numbers", () => {
  it("issues a human-readable receipt number on every payment", async () => {
    const result = await pay();

    expect(result.ok).toBe(true);
    const payment = await prisma.payment.findFirstOrThrow({ where: { studentId } });
    expect(payment.receiptNumber).toBe("RCP-0001");
  });

  it("numbers receipts sequentially within the institute", async () => {
    await pay();
    await pay({ installmentId: installmentIds[1] });
    await pay({ installmentId: installmentIds[2] });

    const numbers = (
      await prisma.payment.findMany({ where: { tenantId: f.tenant.id }, orderBy: { createdAt: "asc" } })
    ).map((p) => p.receiptNumber);
    expect(numbers).toEqual(["RCP-0001", "RCP-0002", "RCP-0003"]);
  });

  it("restarts numbering per institute so tenants never share a sequence", async () => {
    await pay();
    const other = await prisma.tenant.create({ data: { name: "Other", subdomain: "other" } });
    const otherUser = await prisma.user.create({
      data: { tenantId: other.id, email: "f@other.local", name: "F", passwordHash: "x", role: "FINANCE" },
    });
    const otherBatch = await prisma.batch.create({
      data: { tenantId: other.id, name: "B", startYear: 2025, endYear: 2026 },
    });
    const otherCourse = await prisma.course.create({ data: { tenantId: other.id, batchId: otherBatch.id, name: "C" } });
    const otherStudent = await prisma.student.create({
      data: { tenantId: other.id, name: "Theirs", enrollmentNumber: "O-1", courseId: otherCourse.id },
    });
    const otherPlan = await prisma.feePlan.create({
      data: { tenantId: other.id, studentId: otherStudent.id, totalAmount: 1000 },
    });
    setTestActor({ id: otherUser.id, role: "FINANCE", tenantId: other.id });

    await logPayment({
      studentId: otherStudent.id,
      feePlanId: otherPlan.id,
      amount: 500,
      mode: "CASH",
      paidAt: "2026-01-10",
    });

    const theirs = await prisma.payment.findFirstOrThrow({ where: { tenantId: other.id } });
    expect(theirs.receiptNumber).toBe("RCP-0001");
  });

  it("marks a correction against the receipt it corrects", async () => {
    await pay();
    const original = await prisma.payment.findFirstOrThrow({ where: { studentId } });

    await correctPayment({ paymentId: original.id, correctedAmount: 15000, note: "Overcharged by 5000" });

    const correction = await prisma.payment.findFirstOrThrow({ where: { correctionOfId: original.id } });
    expect(correction.receiptNumber).toBe("RCP-0001-R");
    expect(Number(correction.amount)).toBe(-5000);
  });
});

describe("logPayment guards", () => {
  it("refuses to take more than the outstanding balance", async () => {
    const result = await pay({ amount: 60001, installmentId: undefined });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("60,000");
    expect(await prisma.payment.count()).toBe(0);
  });

  it("accepts a payment that settles the balance exactly", async () => {
    const result = await pay({ amount: 60000, installmentId: undefined });

    expect(result.ok).toBe(true);
  });

  it("counts what is already paid when checking the balance", async () => {
    await pay({ amount: 50000, installmentId: undefined });

    const result = await pay({ amount: 20000, installmentId: undefined });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("10,000");
  });

  it("refuses an installment that belongs to a different fee plan", async () => {
    const otherStudent = await createStudent(f, { name: "Other student" });
    const otherPlan = await prisma.feePlan.create({
      data: {
        tenantId: f.tenant.id,
        studentId: otherStudent.id,
        totalAmount: 60000,
        installments: { create: [{ label: "I1", amount: 20000, sequence: 1, dueDate: new Date("2026-01-15") }] },
      },
      include: { installments: true },
    });

    const result = await pay({ installmentId: otherPlan.installments[0].id });

    expect(result.ok).toBe(false);
    expect(await prisma.payment.count({ where: { studentId } })).toBe(0);
  });

  it("refuses a fee plan that belongs to another student", async () => {
    const otherStudent = await createStudent(f, { name: "Other student" });

    const result = await logPayment({
      studentId: otherStudent.id,
      feePlanId,
      amount: 1000,
      mode: "CASH",
      paidAt: "2026-01-10",
    });

    expect(result.ok).toBe(false);
  });

  it("is denied to a counselor", async () => {
    setTestActor({ id: f.counselor.id, role: "COUNSELOR" });

    const result = await pay();

    expect(result.ok).toBe(false);
    expect(await prisma.payment.count()).toBe(0);
  });
});

describe("correctPayment guards", () => {
  it("will not reverse the same payment twice", async () => {
    await pay();
    const original = await prisma.payment.findFirstOrThrow({ where: { studentId } });
    await correctPayment({ paymentId: original.id, correctedAmount: 15000, note: "First correction" });

    const second = await correctPayment({ paymentId: original.id, correctedAmount: 10000, note: "Second correction" });

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.toLowerCase()).toContain("already");
    expect(await prisma.payment.count({ where: { correctionOfId: original.id } })).toBe(1);
  });

  it("will not correct a correction row", async () => {
    await pay();
    const original = await prisma.payment.findFirstOrThrow({ where: { studentId } });
    await correctPayment({ paymentId: original.id, correctedAmount: 15000, note: "Correcting" });
    const correction = await prisma.payment.findFirstOrThrow({ where: { correctionOfId: original.id } });

    const result = await correctPayment({ paymentId: correction.id, correctedAmount: 0, note: "Correcting a correction" });

    expect(result.ok).toBe(false);
  });

  it("keeps the derived balance correct after a correction", async () => {
    await pay({ amount: 20000, installmentId: undefined });
    const original = await prisma.payment.findFirstOrThrow({ where: { studentId } });

    await correctPayment({ paymentId: original.id, correctedAmount: 12000, note: "Bank returned 8000" });

    const payments = await prisma.payment.findMany({ where: { studentId } });
    const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    expect(paid).toBe(12000);
  });

  it("refuses a correction that would push total paid below zero", async () => {
    await pay({ amount: 20000, installmentId: undefined });
    const original = await prisma.payment.findFirstOrThrow({ where: { studentId } });

    const result = await correctPayment({ paymentId: original.id, correctedAmount: -5000, note: "Nonsense" });

    expect(result.ok).toBe(false);
  });

  it("refuses to correct a payment from another tenant", async () => {
    await pay();
    const original = await prisma.payment.findFirstOrThrow({ where: { studentId } });
    const other = await prisma.tenant.create({ data: { name: "Other", subdomain: "other" } });
    setTestActor({ role: "FINANCE", tenantId: other.id });

    const result = await correctPayment({ paymentId: original.id, correctedAmount: 1, note: "Hijack" });

    expect(result.ok).toBe(false);
  });
});
