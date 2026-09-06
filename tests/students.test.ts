import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { setStudentStatus, deleteStudent } from "@/lib/actions/admissions";

let f: Fixture;

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
});

async function giveStudentAPayment(studentId: string) {
  const plan = await prisma.feePlan.create({
    data: {
      tenantId: f.tenant.id,
      studentId,
      feeStructureId: f.feeStructure.id,
      totalAmount: 60000,
      installments: { create: [{ label: "Installment 1", amount: 20000, sequence: 1, dueDate: new Date("2026-01-15") }] },
    },
  });
  await prisma.payment.create({
    data: {
      tenantId: f.tenant.id,
      studentId,
      feePlanId: plan.id,
      amount: 20000,
      mode: "UPI",
      paidAt: new Date(),
      collectedById: f.finance.id,
    },
  });
}

describe("setStudentStatus", () => {
  it("moves an active student to inactive", async () => {
    const student = await createStudent(f, { status: "ACTIVE" });

    const result = await setStudentStatus(student.id, "INACTIVE");

    expect(result.ok).toBe(true);
    const row = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(row.status).toBe("INACTIVE");
  });

  it("can bring a student back to active", async () => {
    const student = await createStudent(f, { status: "INACTIVE" });

    await setStudentStatus(student.id, "ACTIVE");

    const row = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(row.status).toBe("ACTIVE");
  });

  it("records who changed the status and what changed", async () => {
    const student = await createStudent(f, { status: "ACTIVE" });

    await setStudentStatus(student.id, "INACTIVE");

    const log = await prisma.auditLog.findFirst({
      where: { entityType: "Student", entityId: student.id, action: "UPDATE_STATUS" },
    });
    expect(log).not.toBeNull();
    expect(log!.actorId).toBe(f.admin.id);
    expect(log!.diff).toMatchObject({ from: "ACTIVE", to: "INACTIVE" });
  });

  it("rejects a status outside the enum", async () => {
    const student = await createStudent(f, { status: "ACTIVE" });

    const result = await setStudentStatus(student.id, "ALUMNI" as never);

    expect(result.ok).toBe(false);
    const row = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(row.status).toBe("ACTIVE");
  });

  it("is allowed for an admission officer", async () => {
    const student = await createStudent(f, { status: "ACTIVE" });
    setTestActor({ id: f.admissions.id, role: "ADMISSION_OFFICER" });

    const result = await setStudentStatus(student.id, "INACTIVE");

    expect(result.ok).toBe(true);
  });

  it("is denied to a teacher", async () => {
    const student = await createStudent(f, { status: "ACTIVE" });
    setTestActor({ id: f.teacher.id, role: "TEACHER" });

    const result = await setStudentStatus(student.id, "INACTIVE");

    expect(result.ok).toBe(false);
    const row = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(row.status).toBe("ACTIVE");
  });
});

describe("deleteStudent", () => {
  it("deletes a student who has no financial history", async () => {
    const student = await createStudent(f);

    const result = await deleteStudent(student.id);

    expect(result.ok).toBe(true);
    expect(await prisma.student.findUnique({ where: { id: student.id } })).toBeNull();
  });

  it("refuses to delete a student with payment entries and says what to do instead", async () => {
    const student = await createStudent(f);
    await giveStudentAPayment(student.id);

    const result = await deleteStudent(student.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain("inactive");
    expect(await prisma.student.findUnique({ where: { id: student.id } })).not.toBeNull();
  });

  it("records an audit entry naming the deleted student", async () => {
    const student = await createStudent(f, { name: "Riya Sharma" });

    await deleteStudent(student.id);

    const log = await prisma.auditLog.findFirst({
      where: { entityType: "Student", entityId: student.id, action: "DELETE" },
    });
    expect(log).not.toBeNull();
    expect(log!.diff).toMatchObject({ name: "Riya Sharma" });
  });

  it("removes the student's KYC checklist along with them", async () => {
    const student = await createStudent(f);
    await prisma.kycDocument.create({
      data: { tenantId: f.tenant.id, studentId: student.id, docType: "ID_PROOF" },
    });

    await deleteStudent(student.id);

    expect(await prisma.kycDocument.count({ where: { studentId: student.id } })).toBe(0);
  });

  it("is denied to an admission officer — deletion is admin-only", async () => {
    const student = await createStudent(f);
    setTestActor({ id: f.admissions.id, role: "ADMISSION_OFFICER" });

    const result = await deleteStudent(student.id);

    expect(result.ok).toBe(false);
    expect(await prisma.student.findUnique({ where: { id: student.id } })).not.toBeNull();
  });

  it("refuses a student from another tenant", async () => {
    const other = await prisma.tenant.create({ data: { name: "Other", subdomain: "other" } });
    const otherBatch = await prisma.batch.create({
      data: { tenantId: other.id, name: "B", startYear: 2025, endYear: 2026 },
    });
    const otherCourse = await prisma.course.create({
      data: { tenantId: other.id, batchId: otherBatch.id, name: "C" },
    });
    const foreign = await prisma.student.create({
      data: { tenantId: other.id, name: "Theirs", enrollmentNumber: "O-1", courseId: otherCourse.id },
    });

    const result = await deleteStudent(foreign.id);

    expect(result.ok).toBe(false);
    expect(await prisma.student.findUnique({ where: { id: foreign.id } })).not.toBeNull();
  });
});
