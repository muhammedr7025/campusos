import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { createAssignment } from "@/lib/actions/assignments";
import { ENROLLED_STUDENT_WHERE } from "@/lib/academics/enrollment";

let f: Fixture;

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
  setTestActor({ id: f.teacher.id, role: "TEACHER" });
});

/**
 * A student is KYC_PENDING from admission until their documents are verified
 * — days or weeks during which they attend class and sit exams. Every
 * institute-wide count already treats them as enrolled; the teacher-facing
 * rosters used to disagree, which left them unmarkable and, worse, silently
 * excluded from assignments issued in that window.
 */
describe("students awaiting KYC", () => {
  it("get a submission row when an assignment is issued", async () => {
    const active = await createStudent(f, { name: "Active Anita", status: "ACTIVE" });
    const pending = await createStudent(f, { name: "Pending Pranav", status: "KYC_PENDING" });
    const inactive = await createStudent(f, { name: "Gone Gita", status: "INACTIVE" });

    const result = await createAssignment(
      formFor({
        divisionId: f.division.id,
        subjectId: f.subject.id,
        title: "Kinematics problem set",
        dueDate: "2026-03-01",
      }),
    );
    expect(result.ok).toBe(true);

    const submissions = await prisma.submission.findMany({ select: { studentId: true } });
    const ids = submissions.map((s) => s.studentId).sort();
    expect(ids).toEqual([active.id, pending.id].sort());
    expect(ids).not.toContain(inactive.id);
  });

  it("appear on a division's roster, and withdrawn students don't", async () => {
    const active = await createStudent(f, { name: "Active Anita", status: "ACTIVE" });
    const pending = await createStudent(f, { name: "Pending Pranav", status: "KYC_PENDING" });
    await createStudent(f, { name: "Gone Gita", status: "INACTIVE" });

    // The exact query the attendance sheet, the marks sheet and the teacher's
    // student list all run.
    const roster = await prisma.student.findMany({
      where: { tenantId: f.tenant.id, divisionId: f.division.id, ...ENROLLED_STUDENT_WHERE },
      select: { id: true },
    });

    expect(roster.map((s) => s.id).sort()).toEqual([active.id, pending.id].sort());
  });
});

function formFor(fields: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}
