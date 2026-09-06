import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { getFeeSummaryForTenant, getCurrentFeePlanForStudent } from "@/lib/fees/balance";
import { requestDiscount, decideDiscount } from "@/lib/actions/discounts";
import { logPayment } from "@/lib/actions/finance";

let f: Fixture;
let studentId: string;

async function planFor(studentId: string, total = 60000) {
  return prisma.feePlan.create({
    data: {
      tenantId: f.tenant.id,
      studentId,
      feeStructureId: f.feeStructure.id,
      totalAmount: total,
      installments: {
        create: [1, 2, 3].map((n) => ({
          label: `Installment ${n}`,
          amount: total / 3,
          sequence: n,
          dueDate: new Date(`2026-0${n}-15`),
        })),
      },
    },
    include: { installments: { orderBy: { sequence: "asc" } } },
  });
}

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
  const student = await createStudent(f);
  studentId = student.id;
  await planFor(studentId);
  setTestActor({ id: f.finance.id, role: "FINANCE" });
});

/** Pays 20000, then gets a 6000 discount approved — the realistic sequence. */
async function payThenDiscount() {
  const plan = await prisma.feePlan.findFirstOrThrow({ where: { studentId } });
  await logPayment({ studentId, feePlanId: plan.id, amount: 20000, mode: "UPI", paidAt: "2026-01-10" });

  const requested = await requestDiscount({
    studentId,
    kind: "Sibling discount",
    amount: 6000,
    reason: "Brother enrolled too",
  });
  if (!requested.ok) throw new Error(requested.error);

  setTestActor({ id: f.admin.id, role: "SUPER_ADMIN" });
  const decided = await decideDiscount(requested.data.id, true);
  if (!decided.ok) throw new Error(decided.error);
}

describe("a student on an overridden fee plan", () => {
  it("appears once in the institute summary, not once per plan", async () => {
    await payThenDiscount();

    const summary = await getFeeSummaryForTenant(f.tenant.id);

    expect(summary.filter((s) => s.studentId === studentId)).toHaveLength(1);
  });

  it("is billed the discounted total institute-wide", async () => {
    await payThenDiscount();

    const [row] = await getFeeSummaryForTenant(f.tenant.id);

    expect(row.total).toBe(54000);
  });

  it("keeps credit for money paid before the discount was approved", async () => {
    await payThenDiscount();

    const [row] = await getFeeSummaryForTenant(f.tenant.id);

    expect(row.paid).toBe(20000);
    expect(row.balance).toBe(34000);
  });

  it("shows the same figures on the student's own fee page", async () => {
    await payThenDiscount();

    const current = await getCurrentFeePlanForStudent(f.tenant.id, studentId);

    expect(current).not.toBeNull();
    expect(current!.total).toBe(54000);
    expect(current!.paid).toBe(20000);
    expect(current!.balance).toBe(34000);
  });

  it("still lists the payments made against the superseded plan", async () => {
    await payThenDiscount();

    const current = await getCurrentFeePlanForStudent(f.tenant.id, studentId);

    expect(current!.plan.payments).toHaveLength(1);
    expect(Number(current!.plan.payments[0].amount)).toBe(20000);
  });

  it("does not double-count the institute's billed total", async () => {
    await payThenDiscount();

    const summary = await getFeeSummaryForTenant(f.tenant.id);
    const billed = summary.reduce((sum, s) => sum + s.total, 0);

    expect(billed).toBe(54000);
  });
});

describe("the overpayment guard after an override", () => {
  it("still counts money paid under the superseded plan", async () => {
    await payThenDiscount();
    const current = await prisma.feePlan.findFirstOrThrow({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    });
    setTestActor({ id: f.finance.id, role: "FINANCE" });

    // 54,000 billed − 20,000 already paid leaves 34,000.
    const tooMuch = await logPayment({
      studentId,
      feePlanId: current.id,
      amount: 34001,
      mode: "CASH",
      paidAt: "2026-02-10",
    });

    expect(tooMuch.ok).toBe(false);
    if (!tooMuch.ok) expect(tooMuch.error).toContain("34,000");
  });

  it("accepts the exact remaining balance", async () => {
    await payThenDiscount();
    const current = await prisma.feePlan.findFirstOrThrow({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    });
    setTestActor({ id: f.finance.id, role: "FINANCE" });

    const result = await logPayment({
      studentId,
      feePlanId: current.id,
      amount: 34000,
      mode: "CASH",
      paidAt: "2026-02-10",
    });

    expect(result.ok).toBe(true);
    const [row] = await getFeeSummaryForTenant(f.tenant.id);
    expect(row.balance).toBe(0);
  });
});

describe("students without an override are unaffected", () => {
  it("reports one row per student with the right balance", async () => {
    const second = await createStudent(f, { name: "Second student" });
    await planFor(second.id, 30000);
    const plan = await prisma.feePlan.findFirstOrThrow({ where: { studentId: second.id } });
    await logPayment({ studentId: second.id, feePlanId: plan.id, amount: 10000, mode: "CASH", paidAt: "2026-01-10" });

    const summary = await getFeeSummaryForTenant(f.tenant.id);
    const row = summary.find((s) => s.studentId === second.id)!;

    expect(summary).toHaveLength(2);
    expect(row.total).toBe(30000);
    expect(row.paid).toBe(10000);
    expect(row.balance).toBe(20000);
  });

  it("leaves a student with no fee plan out of the summary entirely", async () => {
    await createStudent(f, { name: "Unbilled student" });

    const summary = await getFeeSummaryForTenant(f.tenant.id);

    expect(summary.map((s) => s.studentName)).not.toContain("Unbilled student");
  });
});
