import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { markAttendance } from "@/lib/actions/attendance";

let f: Fixture;
let student: { id: string };

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
  student = await createStudent(f);
  setTestActor({ id: f.teacher.id, role: "TEACHER" });
});

function sheet(entries: { studentId: string; status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" }[], overrides: Partial<{ divisionId: string; subjectId: string }> = {}) {
  return {
    divisionId: overrides.divisionId ?? f.division.id,
    subjectId: overrides.subjectId ?? f.subject.id,
    date: "2026-03-02",
    entries,
  };
}

describe("markAttendance", () => {
  it("records the roster it was given", async () => {
    const result = await markAttendance(sheet([{ studentId: student.id, status: "PRESENT" }]));

    expect(result.ok).toBe(true);
    const rows = await prisma.attendance.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("PRESENT");
    expect(rows[0].tenantId).toBe(f.tenant.id);
  });

  it("is idempotent — re-marking the same status doesn't duplicate a row", async () => {
    await markAttendance(sheet([{ studentId: student.id, status: "PRESENT" }]));
    await markAttendance(sheet([{ studentId: student.id, status: "PRESENT" }]));

    expect(await prisma.attendance.count()).toBe(1);
  });

  it("records a correction as an edit of the same row", async () => {
    await markAttendance(sheet([{ studentId: student.id, status: "ABSENT" }]));
    await markAttendance(sheet([{ studentId: student.id, status: "PRESENT" }]));

    const rows = await prisma.attendance.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("PRESENT");
    expect(rows[0].editedAt).not.toBeNull();
  });

  it("refuses a student from another institute", async () => {
    const other = await prisma.tenant.create({ data: { name: "Other", subdomain: "other-att" } });
    const otherBatch = await prisma.batch.create({
      data: { tenantId: other.id, name: "2025", startYear: 2025, endYear: 2026, status: "ACTIVE" },
    });
    const otherCourse = await prisma.course.create({
      data: { tenantId: other.id, batchId: otherBatch.id, name: "Other course", durationLabel: "1y" },
    });
    const outsider = await prisma.student.create({
      data: { tenantId: other.id, name: "Outsider", enrollmentNumber: "O-1", courseId: otherCourse.id, status: "ACTIVE" },
    });

    const result = await markAttendance(sheet([{ studentId: outsider.id, status: "PRESENT" }]));

    expect(result.ok).toBe(false);
    expect(await prisma.attendance.count()).toBe(0);
  });

  it("refuses a student who isn't in the division being marked", async () => {
    const elsewhere = await prisma.division.create({
      data: { tenantId: f.tenant.id, courseId: f.course.id, name: "Evening B", capacity: 30 },
    });
    const otherStudent = await createStudent(f, { enrollmentNumber: "T-EVE", divisionId: elsewhere.id });

    const result = await markAttendance(sheet([{ studentId: otherStudent.id, status: "PRESENT" }]));

    expect(result.ok).toBe(false);
    expect(await prisma.attendance.count()).toBe(0);
  });

  it("refuses a division from another institute", async () => {
    const other = await prisma.tenant.create({ data: { name: "Other", subdomain: "other-div" } });
    const otherBatch = await prisma.batch.create({
      data: { tenantId: other.id, name: "2025", startYear: 2025, endYear: 2026, status: "ACTIVE" },
    });
    const otherCourse = await prisma.course.create({
      data: { tenantId: other.id, batchId: otherBatch.id, name: "Other course", durationLabel: "1y" },
    });
    const otherDivision = await prisma.division.create({
      data: { tenantId: other.id, courseId: otherCourse.id, name: "Theirs", capacity: 10 },
    });

    const result = await markAttendance(
      sheet([{ studentId: student.id, status: "PRESENT" }], { divisionId: otherDivision.id }),
    );

    expect(result.ok).toBe(false);
    expect(await prisma.attendance.count()).toBe(0);
  });

  it("refuses a subject from another institute", async () => {
    const other = await prisma.tenant.create({ data: { name: "Other", subdomain: "other-sub" } });
    const otherBatch = await prisma.batch.create({
      data: { tenantId: other.id, name: "2025", startYear: 2025, endYear: 2026, status: "ACTIVE" },
    });
    const otherCourse = await prisma.course.create({
      data: { tenantId: other.id, batchId: otherBatch.id, name: "Other course", durationLabel: "1y" },
    });
    const otherSubject = await prisma.subject.create({
      data: { tenantId: other.id, courseId: otherCourse.id, name: "Theirs" },
    });

    const result = await markAttendance(
      sheet([{ studentId: student.id, status: "PRESENT" }], { subjectId: otherSubject.id }),
    );

    expect(result.ok).toBe(false);
    expect(await prisma.attendance.count()).toBe(0);
  });

  it("writes nothing at all when one name on the sheet is invalid", async () => {
    const valid = await createStudent(f, { enrollmentNumber: "T-OK" });

    const result = await markAttendance(
      sheet([
        { studentId: valid.id, status: "PRESENT" },
        { studentId: "not-a-student", status: "ABSENT" },
      ]),
    );

    expect(result.ok).toBe(false);
    expect(await prisma.attendance.count()).toBe(0);
  });

  it("still marks a student who is awaiting KYC", async () => {
    const pending = await createStudent(f, { enrollmentNumber: "T-KYC", status: "KYC_PENDING" });

    const result = await markAttendance(sheet([{ studentId: pending.id, status: "PRESENT" }]));

    expect(result.ok).toBe(true);
    expect(await prisma.attendance.count()).toBe(1);
  });
});
