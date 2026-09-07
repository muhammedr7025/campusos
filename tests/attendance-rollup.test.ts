import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { attendancePercent, percentByKey, percentFromCounts } from "@/lib/academics/attendance";

let f: Fixture;

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
});

async function mark(studentId: string, statuses: ("PRESENT" | "ABSENT" | "LATE" | "EXCUSED")[]) {
  let day = 1;
  for (const status of statuses) {
    await prisma.attendance.create({
      data: {
        tenantId: f.tenant.id,
        studentId,
        divisionId: f.division.id,
        subjectId: f.subject.id,
        date: new Date(`2026-03-${String(day++).padStart(2, "0")}T00:00:00Z`),
        status,
        markedById: f.teacher.id,
      },
    });
  }
}

describe("percentFromCounts", () => {
  it("counts late as attended and excused as not, like the row-by-row version", () => {
    const rows = [
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "LATE" },
      { status: "EXCUSED" },
    ];
    const counts = [
      { status: "PRESENT", count: 2 },
      { status: "LATE", count: 1 },
      { status: "EXCUSED", count: 1 },
    ];

    expect(percentFromCounts(counts)).toBe(attendancePercent(rows));
    expect(percentFromCounts(counts)).toBe(75);
  });

  it("has no percentage to report when nothing was ever marked", () => {
    expect(percentFromCounts([])).toBeNull();
    expect(percentFromCounts([{ status: "PRESENT", count: 0 }])).toBeNull();
  });
});

describe("percentByKey over a real groupBy", () => {
  it("gives each student the same figure the old per-row count did", async () => {
    const a = await createStudent(f, { enrollmentNumber: "R-A" });
    const b = await createStudent(f, { enrollmentNumber: "R-B" });
    await mark(a.id, ["PRESENT", "PRESENT", "PRESENT", "ABSENT"]); // 75
    await mark(b.id, ["PRESENT", "ABSENT"]); // 50

    const grouped = await prisma.attendance.groupBy({
      by: ["studentId", "status"],
      where: { tenantId: f.tenant.id },
      _count: { _all: true },
    });
    const byStudent = percentByKey(grouped, "studentId");

    const rowsA = await prisma.attendance.findMany({ where: { studentId: a.id }, select: { status: true } });
    const rowsB = await prisma.attendance.findMany({ where: { studentId: b.id }, select: { status: true } });

    expect(byStudent.get(a.id)).toBe(attendancePercent(rowsA));
    expect(byStudent.get(b.id)).toBe(attendancePercent(rowsB));
    expect(byStudent.get(a.id)).toBe(75);
    expect(byStudent.get(b.id)).toBe(50);
  });

  it("leaves out a student with no attendance at all", async () => {
    const marked = await createStudent(f, { enrollmentNumber: "R-M" });
    const unmarked = await createStudent(f, { enrollmentNumber: "R-U" });
    await mark(marked.id, ["PRESENT"]);

    const grouped = await prisma.attendance.groupBy({
      by: ["studentId", "status"],
      where: { tenantId: f.tenant.id },
      _count: { _all: true },
    });

    const byStudent = percentByKey(grouped, "studentId");
    expect(byStudent.get(unmarked.id)).toBeUndefined();
    expect(byStudent.get(marked.id)).toBe(100);
  });

  it("rolls up by division as well", async () => {
    const a = await createStudent(f, { enrollmentNumber: "R-D1" });
    const b = await createStudent(f, { enrollmentNumber: "R-D2" });
    await mark(a.id, ["PRESENT", "ABSENT"]);
    await mark(b.id, ["PRESENT", "PRESENT"]);

    const grouped = await prisma.attendance.groupBy({
      by: ["divisionId", "status"],
      where: { tenantId: f.tenant.id },
      _count: { _all: true },
    });

    // Three present out of four marks across the division.
    expect(percentByKey(grouped, "divisionId").get(f.division.id)).toBe(75);
  });
});
