import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { createExam } from "@/lib/actions/exams";
import { createSubjectNote } from "@/lib/actions/notes";
import { createTimetableEntry } from "@/lib/actions/timetable";
import { createFeeStructure } from "@/lib/actions/finance";
import { createLead } from "@/lib/actions/leads";
import { assertOwned } from "@/lib/rbac/ownership";

let f: Fixture;
/** A complete second institute, to borrow ids from. */
let other: Awaited<ReturnType<typeof seedOtherTenant>>;

async function seedOtherTenant() {
  const tenant = await prisma.tenant.create({ data: { name: "Rival Institute", subdomain: "rival" } });
  const batch = await prisma.batch.create({
    data: { tenantId: tenant.id, name: "2025", startYear: 2025, endYear: 2026, status: "ACTIVE" },
  });
  const course = await prisma.course.create({
    data: { tenantId: tenant.id, batchId: batch.id, name: "Rival course", durationLabel: "1y" },
  });
  const subject = await prisma.subject.create({ data: { tenantId: tenant.id, courseId: course.id, name: "Rival Physics" } });
  const division = await prisma.division.create({ data: { tenantId: tenant.id, courseId: course.id, name: "Rival A", capacity: 10 } });
  const teacher = await prisma.user.create({
    data: { tenantId: tenant.id, email: "t@rival.local", name: "Rival Teacher", passwordHash: "x", role: "TEACHER" },
  });
  const student = await prisma.student.create({
    data: { tenantId: tenant.id, name: "Rival Student", enrollmentNumber: "R-1", courseId: course.id, status: "ACTIVE" },
  });
  return { tenant, course, subject, division, teacher, student };
}

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
  other = await seedOtherTenant();
});

/**
 * Tenant scoping on the write isn't enough by itself: a foreign key only
 * checks that a row exists *somewhere*, so an id belonging to another
 * institute stores happily under ours. These all go through the real
 * actions, as a hand-made request would.
 */
describe("references borrowed from another institute", () => {
  it("are refused when scheduling an exam", async () => {
    setTestActor({ id: f.teacher.id, role: "TEACHER" });

    const result = await createExam({
      name: "Midterm",
      divisionId: other.division.id,
      subjectId: f.subject.id,
      examDate: "2026-04-01",
      maxMarks: 100,
    });

    expect(result.ok).toBe(false);
    expect(await prisma.exam.count()).toBe(0);
  });

  it("are refused when publishing notes", async () => {
    setTestActor({ id: f.teacher.id, role: "TEACHER" });
    const form = new FormData();
    form.set("courseId", other.course.id);
    form.set("subjectId", f.subject.id);
    form.set("title", "Borrowed course");
    form.set("kind", "CLASS_NOTES");
    form.set("text", "");
    form.set("pages", "");

    const result = await createSubjectNote(form);

    expect(result.ok).toBe(false);
    expect(await prisma.subjectNote.count()).toBe(0);
  });

  it("are refused when scheduling a class for another institute's teacher", async () => {
    setTestActor({ id: f.admin.id, role: "SUPER_ADMIN" });

    const result = await createTimetableEntry({
      divisionId: f.division.id,
      subjectId: f.subject.id,
      teacherId: other.teacher.id,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      room: "1",
    });

    expect(result.ok).toBe(false);
    expect(await prisma.timetable.count()).toBe(0);
  });

  it("are refused when creating a fee structure", async () => {
    setTestActor({ id: f.finance.id, role: "FINANCE" });

    const result = await createFeeStructure({
      courseId: other.course.id,
      name: "Borrowed",
      lateFeeType: "FLAT",
      lateFeeValue: 0,
      gracePeriodDays: 0,
      installments: [{ label: "One", amount: 1000, sequence: 1, dueDate: "2026-01-15" }],
    });

    expect(result.ok).toBe(false);
    expect(await prisma.feeStructure.count({ where: { tenantId: f.tenant.id, name: "Borrowed" } })).toBe(0);
  });

  it("are refused when creating an enquiry against their course", async () => {
    setTestActor({ id: f.counselor.id, role: "COUNSELOR" });

    const result = await createLead({
      name: "Walk-in",
      phone: "9998887777",
      source: "WALK_IN",
      interestedCourseId: other.course.id,
    });

    expect(result.ok).toBe(false);
    expect(await prisma.lead.count()).toBe(0);
  });
});

describe("assertOwned", () => {
  it("passes when every reference is ours", async () => {
    const student = await createStudent(f);
    await expect(
      assertOwned(f.tenant.id, {
        course: f.course.id,
        division: f.division.id,
        subject: f.subject.id,
        student: student.id,
        teacher: f.teacher.id,
      }),
    ).resolves.toBeUndefined();
  });

  it("ignores blank and missing references", async () => {
    await expect(assertOwned(f.tenant.id, { course: null, division: undefined, subject: "" })).resolves.toBeUndefined();
  });

  it("names what was wrong", async () => {
    await expect(assertOwned(f.tenant.id, { division: other.division.id })).rejects.toThrow(/division/i);
    await expect(assertOwned(f.tenant.id, { student: other.student.id })).rejects.toThrow(/student/i);
  });

  it("refuses a user who exists here but isn't a teacher", async () => {
    await expect(assertOwned(f.tenant.id, { teacher: f.finance.id })).rejects.toThrow(/teacher/i);
    await expect(assertOwned(f.tenant.id, { user: f.finance.id })).resolves.toBeUndefined();
  });
});
