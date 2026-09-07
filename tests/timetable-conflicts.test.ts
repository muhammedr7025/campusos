import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { createTimetableEntry, updateTimetableEntry } from "@/lib/actions/timetable";

let f: Fixture;
let secondTeacher: { id: string };
let secondSubject: { id: string };
let secondDivision: { id: string };

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
  secondTeacher = await prisma.user.create({
    data: { tenantId: f.tenant.id, email: "t2@test.local", name: "Second Teacher", passwordHash: "x", role: "TEACHER" },
  });
  secondSubject = await prisma.subject.create({
    data: { tenantId: f.tenant.id, courseId: f.course.id, name: "Chemistry" },
  });
  secondDivision = await prisma.division.create({
    data: { tenantId: f.tenant.id, courseId: f.course.id, name: "Morning B", capacity: 40 },
  });
  setTestActor({ id: f.admin.id, role: "SUPER_ADMIN" });
});

function slot(overrides: Partial<{ divisionId: string; subjectId: string; teacherId: string; startTime: string; endTime: string; room: string; dayOfWeek: number }> = {}) {
  return {
    divisionId: overrides.divisionId ?? f.division.id,
    subjectId: overrides.subjectId ?? f.subject.id,
    teacherId: overrides.teacherId ?? f.teacher.id,
    dayOfWeek: overrides.dayOfWeek ?? 1,
    startTime: overrides.startTime ?? "09:00",
    endTime: overrides.endTime ?? "10:00",
    room: overrides.room ?? "",
  };
}

describe("timetable clashes", () => {
  it("still refuses to double-book a teacher", async () => {
    await createTimetableEntry(slot());

    const result = await createTimetableEntry(slot({ divisionId: secondDivision.id, subjectId: secondSubject.id }));

    expect(result.ok).toBe(false);
    expect(await prisma.timetable.count()).toBe(1);
  });

  it("refuses to put a division in two classes at once", async () => {
    await createTimetableEntry(slot());

    // Same division and time, different teacher and subject — the students
    // can't be in both.
    const result = await createTimetableEntry(
      slot({ subjectId: secondSubject.id, teacherId: secondTeacher.id, startTime: "09:30", endTime: "10:30" }),
    );

    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toMatch(/division/i);
    expect(await prisma.timetable.count()).toBe(1);
  });

  it("refuses to double-book a room", async () => {
    await createTimetableEntry(slot({ room: "Lab 1" }));

    const result = await createTimetableEntry(
      slot({ divisionId: secondDivision.id, subjectId: secondSubject.id, teacherId: secondTeacher.id, room: "Lab 1" }),
    );

    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toMatch(/room/i);
  });

  it("allows back-to-back slots that only touch at the boundary", async () => {
    await createTimetableEntry(slot({ startTime: "09:00", endTime: "10:00" }));

    const result = await createTimetableEntry(slot({ subjectId: secondSubject.id, startTime: "10:00", endTime: "11:00" }));

    expect(result.ok).toBe(true);
    expect(await prisma.timetable.count()).toBe(2);
  });

  it("allows the same time on a different day", async () => {
    await createTimetableEntry(slot({ dayOfWeek: 1 }));

    const result = await createTimetableEntry(slot({ dayOfWeek: 2 }));

    expect(result.ok).toBe(true);
  });

  it("doesn't count a slot as clashing with itself when edited", async () => {
    const created = await createTimetableEntry(slot({ room: "Lab 1" }));
    expect(created.ok).toBe(true);
    const id = (created as { data: { id: string } }).data.id;

    const result = await updateTimetableEntry(id, slot({ room: "Lab 1", endTime: "10:30" }));

    expect(result.ok).toBe(true);
    const row = await prisma.timetable.findUniqueOrThrow({ where: { id } });
    expect(row.endTime).toBe("10:30");
  });

  it("checks the division on edit too", async () => {
    await createTimetableEntry(slot());
    const second = await createTimetableEntry(
      slot({ subjectId: secondSubject.id, teacherId: secondTeacher.id, startTime: "11:00", endTime: "12:00" }),
    );
    const id = (second as { data: { id: string } }).data.id;

    // Move the second slot on top of the first one.
    const result = await updateTimetableEntry(
      id,
      slot({ subjectId: secondSubject.id, teacherId: secondTeacher.id, startTime: "09:30", endTime: "10:30" }),
    );

    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toMatch(/division/i);
  });
});
