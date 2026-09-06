import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { ENROLLED_STUDENT_WHERE, countEnrolledStudents } from "@/lib/academics/enrollment";

let f: Fixture;

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
  await createStudent(f, { name: "Active One", status: "ACTIVE" });
  await createStudent(f, { name: "Awaiting KYC", status: "KYC_PENDING" });
  await createStudent(f, { name: "Alumnus", status: "INACTIVE" });
});

describe("who counts as enrolled", () => {
  it("counts admitted students whose paperwork is still pending", async () => {
    expect(await countEnrolledStudents(f.tenant.id)).toBe(2);
  });

  it("leaves alumni out of the headcount", async () => {
    const names = await prisma.student.findMany({
      where: { tenantId: f.tenant.id, ...ENROLLED_STUDENT_WHERE },
      select: { name: true },
    });
    expect(names.map((n) => n.name).sort()).toEqual(["Active One", "Awaiting KYC"]);
  });

  it("gives the same number per course as institute-wide", async () => {
    const institute = await countEnrolledStudents(f.tenant.id);
    const perCourse = await prisma.course.findMany({
      where: { tenantId: f.tenant.id },
      select: { _count: { select: { students: { where: ENROLLED_STUDENT_WHERE } } } },
    });

    expect(perCourse.reduce((sum, c) => sum + c._count.students, 0)).toBe(institute);
  });

  it("gives the same number per division as institute-wide", async () => {
    const institute = await countEnrolledStudents(f.tenant.id);
    const perDivision = await prisma.division.findMany({
      where: { tenantId: f.tenant.id },
      select: { _count: { select: { students: { where: ENROLLED_STUDENT_WHERE } } } },
    });

    expect(perDivision.reduce((sum, d) => sum + d._count.students, 0)).toBe(institute);
  });

  it("gives the same number per batch as institute-wide", async () => {
    const institute = await countEnrolledStudents(f.tenant.id);
    // How the batches list rolls up: group students by course, sum per batch.
    const [batches, grouped] = await Promise.all([
      prisma.batch.findMany({ where: { tenantId: f.tenant.id }, include: { courses: { select: { id: true } } } }),
      prisma.student.groupBy({
        by: ["courseId"],
        where: { tenantId: f.tenant.id, ...ENROLLED_STUDENT_WHERE },
        _count: { _all: true },
      }),
    ]);
    const byCourse = new Map(grouped.map((g) => [g.courseId, g._count._all]));
    const total = batches.reduce(
      (sum, b) => sum + b.courses.reduce((s, c) => s + (byCourse.get(c.id) ?? 0), 0),
      0,
    );

    expect(total).toBe(institute);
  });

  it("frees an alumnus's seat so a division isn't blocked by past cohorts", async () => {
    const tiny = await prisma.division.create({
      data: { tenantId: f.tenant.id, courseId: f.course.id, name: "Tiny", capacity: 1 },
    });
    await createStudent(f, { name: "Old grad", status: "INACTIVE", divisionId: tiny.id });

    const seatsTaken = await prisma.student.count({
      where: { tenantId: f.tenant.id, divisionId: tiny.id, ...ENROLLED_STUDENT_WHERE },
    });

    expect(seatsTaken).toBe(0);
  });
});
