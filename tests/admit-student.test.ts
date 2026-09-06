import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { admitStudent } from "@/lib/actions/admissions";

let f: Fixture;

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Kabir Joshi",
    phone: "+91 90000 11111",
    email: "",
    dob: "",
    address: "",
    courseId: f.course.id,
    divisionId: f.division.id,
    guardianName: "Latha Joshi",
    guardianPhone: "+91 90000 22222",
    guardianEmail: "",
    guardianRelationship: "Mother",
    ...overrides,
  };
}

describe("admitStudent — walk-in admission with no lead record", () => {
  it("creates an enrolled student attached to the chosen course and division", async () => {
    const result = await admitStudent(validInput());

    expect(result.ok).toBe(true);
    const student = await prisma.student.findFirstOrThrow({ where: { name: "Kabir Joshi" } });
    expect(student.courseId).toBe(f.course.id);
    expect(student.divisionId).toBe(f.division.id);
    expect(student.status).toBe("KYC_PENDING");
    expect(student.convertedFromLeadId).toBeNull();
  });

  it("does not invent a lead record", async () => {
    await admitStudent(validInput());

    expect(await prisma.lead.count()).toBe(0);
  });

  it("issues a sequential enrollment number", async () => {
    const first = await admitStudent(validInput());
    const second = await admitStudent(validInput({ name: "Second Student", guardianPhone: "+91 90000 33333" }));

    if (!first.ok || !second.ok) throw new Error("admission failed");
    const year = new Date().getFullYear();
    expect(first.data.enrollmentNumber).toBe(`${year}-0001`);
    expect(second.data.enrollmentNumber).toBe(`${year}-0002`);
  });

  it("provisions a student portal login and returns the credentials once", async () => {
    const result = await admitStudent(validInput());

    if (!result.ok) throw new Error(result.error);
    expect(result.data.studentLogin.password).toBeTruthy();
    const user = await prisma.user.findFirstOrThrow({ where: { email: result.data.studentLogin.email } });
    expect(user.role).toBe("STUDENT");
    const student = await prisma.student.findFirstOrThrow({ where: { name: "Kabir Joshi" } });
    expect(student.userId).toBe(user.id);
  });

  it("creates the guardian, their portal login, and links them as primary", async () => {
    const result = await admitStudent(validInput());

    if (!result.ok) throw new Error(result.error);
    expect(result.data.guardianLogin).not.toBeNull();
    const guardian = await prisma.parentGuardian.findFirstOrThrow({ where: { phone: "+91 90000 22222" } });
    expect(guardian.name).toBe("Latha Joshi");
    const link = await prisma.studentGuardian.findFirstOrThrow({ where: { guardianId: guardian.id } });
    expect(link.isPrimary).toBe(true);
  });

  it("reuses an existing guardian for a sibling instead of duplicating them", async () => {
    await admitStudent(validInput());
    const second = await admitStudent(validInput({ name: "Sibling Joshi" }));

    if (!second.ok) throw new Error(second.error);
    expect(await prisma.parentGuardian.count({ where: { phone: "+91 90000 22222" } })).toBe(1);
    // The parent already has a login, so no second set of credentials is issued.
    expect(second.data.guardianLogin).toBeNull();
    const guardian = await prisma.parentGuardian.findFirstOrThrow({ where: { phone: "+91 90000 22222" } });
    expect(await prisma.studentGuardian.count({ where: { guardianId: guardian.id } })).toBe(2);
  });

  it("bills the student on the course's fee structure", async () => {
    const result = await admitStudent(validInput());

    if (!result.ok) throw new Error(result.error);
    const plan = await prisma.feePlan.findFirstOrThrow({
      where: { studentId: result.data.studentId },
      include: { installments: true },
    });
    expect(Number(plan.totalAmount)).toBe(60000);
    expect(plan.installments).toHaveLength(3);
    expect(plan.feeStructureId).toBe(f.feeStructure.id);
  });

  it("opens the required KYC checklist", async () => {
    const result = await admitStudent(validInput());

    if (!result.ok) throw new Error(result.error);
    const docs = await prisma.kycDocument.findMany({ where: { studentId: result.data.studentId } });
    expect(docs.length).toBeGreaterThanOrEqual(4);
    expect(docs.every((d) => d.status === "PENDING")).toBe(true);
  });

  it("records the enrollment and an audit entry", async () => {
    const result = await admitStudent(validInput());

    if (!result.ok) throw new Error(result.error);
    expect(await prisma.enrollment.count({ where: { studentId: result.data.studentId } })).toBe(1);
    const log = await prisma.auditLog.findFirst({
      where: { entityType: "Student", entityId: result.data.studentId, action: "ADMIT" },
    });
    expect(log).not.toBeNull();
    expect(log!.actorId).toBe(f.admin.id);
  });

  it("refuses a division that is already at capacity", async () => {
    const small = await prisma.division.create({
      data: { tenantId: f.tenant.id, courseId: f.course.id, name: "Tiny", capacity: 1 },
    });
    await createStudent(f, { divisionId: small.id });

    const result = await admitStudent(validInput({ divisionId: small.id }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("capacity");
    expect(await prisma.student.count({ where: { name: "Kabir Joshi" } })).toBe(0);
  });

  it("refuses a division that belongs to a different course", async () => {
    const otherCourse = await prisma.course.create({
      data: { tenantId: f.tenant.id, batchId: f.batch.id, name: "Other course" },
    });
    const otherDivision = await prisma.division.create({
      data: { tenantId: f.tenant.id, courseId: otherCourse.id, name: "Other div", capacity: 10 },
    });

    const result = await admitStudent(validInput({ divisionId: otherDivision.id }));

    expect(result.ok).toBe(false);
  });

  it("rejects incomplete input and writes nothing", async () => {
    const result = await admitStudent(validInput({ name: "", guardianPhone: "" }));

    expect(result.ok).toBe(false);
    expect(await prisma.student.count()).toBe(0);
    expect(await prisma.user.count({ where: { role: "STUDENT" } })).toBe(0);
  });

  it("is allowed for an admission officer", async () => {
    setTestActor({ id: f.admissions.id, role: "ADMISSION_OFFICER" });

    const result = await admitStudent(validInput());

    expect(result.ok).toBe(true);
  });

  it("is denied to a counselor", async () => {
    setTestActor({ id: f.counselor.id, role: "COUNSELOR" });

    const result = await admitStudent(validInput());

    expect(result.ok).toBe(false);
    expect(await prisma.student.count()).toBe(0);
  });
});
