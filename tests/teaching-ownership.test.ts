import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { markAttendance } from "@/lib/actions/attendance";
import { createAssignment, gradeSubmission, submitAssignment } from "@/lib/actions/assignments";
import { createExam, deleteExam, recordMark } from "@/lib/actions/exams";
import { createSubjectNote, deleteSubjectNote } from "@/lib/actions/notes";
import { reassignStudentDivision, admitStudent } from "@/lib/actions/admissions";
import { localDateString } from "@/lib/academics/dates";

let f: Fixture;
/** A second class in the same course that the fixture teacher does NOT teach. */
let otherDivision: { id: string };
let otherTeacher: { id: string };

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
  otherDivision = await prisma.division.create({ data: { tenantId: f.tenant.id, courseId: f.course.id, name: "Evening B", capacity: 40 } });
  otherTeacher = await prisma.user.create({
    data: { tenantId: f.tenant.id, email: "t2@test.local", name: "Other Teacher", passwordHash: "x", role: "TEACHER" },
  });
  await prisma.timetable.create({
    data: { tenantId: f.tenant.id, divisionId: otherDivision.id, subjectId: f.subject.id, teacherId: otherTeacher.id, dayOfWeek: 2, startTime: "09:00", endTime: "10:00" },
  });
  setTestActor({ id: f.teacher.id, role: "TEACHER" });
});

function assignmentForm(divisionId: string, file?: File) {
  const form = new FormData();
  form.set("divisionId", divisionId);
  form.set("subjectId", f.subject.id);
  form.set("title", "Problem set 1");
  form.set("dueDate", "2030-01-01");
  if (file) form.set("attachment", file);
  return form;
}

describe("a teacher acts only for classes on their timetable", () => {
  it("can't mark attendance for someone else's class", async () => {
    const student = await createStudent(f, { divisionId: otherDivision.id });
    const result = await markAttendance({ divisionId: otherDivision.id, subjectId: f.subject.id, date: localDateString(), entries: [{ studentId: student.id, status: "PRESENT" }] });

    expect(result.ok).toBe(false);
    expect(await prisma.attendance.count()).toBe(0);
  });

  it("can mark their own class, and it lands on the calendar day they picked", async () => {
    const student = await createStudent(f);
    const today = localDateString();
    const result = await markAttendance({ divisionId: f.division.id, subjectId: f.subject.id, date: today, entries: [{ studentId: student.id, status: "PRESENT" }] });

    expect(result.ok).toBe(true);
    const row = await prisma.attendance.findFirstOrThrow({ where: { studentId: student.id } });
    expect(row.date.toISOString().slice(0, 10)).toBe(today);
  });

  it("can't mark attendance for a future date", async () => {
    const student = await createStudent(f);
    const result = await markAttendance({ divisionId: f.division.id, subjectId: f.subject.id, date: "2999-01-01", entries: [{ studentId: student.id, status: "PRESENT" }] });

    expect(result.ok).toBe(false);
  });

  it("can't post an assignment to someone else's class", async () => {
    const result = await createAssignment(assignmentForm(otherDivision.id));
    expect(result.ok).toBe(false);
    expect(await prisma.assignment.count()).toBe(0);
  });

  it("can't schedule an exam for someone else's class", async () => {
    const result = await createExam({ divisionId: otherDivision.id, subjectId: f.subject.id, name: "Unit test", date: "2030-01-01", maxMarks: 50 });
    expect(result.ok).toBe(false);
  });

  it("can't record a mark for a student outside the exam's division", async () => {
    const created = await createExam({ divisionId: f.division.id, subjectId: f.subject.id, name: "Unit test", date: "2030-01-01", maxMarks: 50 });
    if (!created.ok) throw new Error(created.error);
    const outsider = await createStudent(f, { divisionId: otherDivision.id });

    const result = await recordMark({ examId: created.data.id, studentId: outsider.id, score: 40 });

    expect(result.ok).toBe(false);
    expect(await prisma.mark.count()).toBe(0);
  });

  it("can't delete another teacher's exam, nor one that already has marks", async () => {
    setTestActor({ id: otherTeacher.id, role: "TEACHER" });
    const theirs = await createExam({ divisionId: otherDivision.id, subjectId: f.subject.id, name: "Theirs", date: "2030-01-01", maxMarks: 50 });
    if (!theirs.ok) throw new Error(theirs.error);
    setTestActor({ id: f.teacher.id, role: "TEACHER" });
    expect((await deleteExam(theirs.data.id)).ok).toBe(false);

    const mine = await createExam({ divisionId: f.division.id, subjectId: f.subject.id, name: "Mine", date: "2030-01-01", maxMarks: 50 });
    if (!mine.ok) throw new Error(mine.error);
    const student = await createStudent(f);
    await recordMark({ examId: mine.data.id, studentId: student.id, score: 45 });
    const del = await deleteExam(mine.data.id);
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.error).toContain("Marks");
    expect(await prisma.exam.count()).toBe(2);
  });

  it("can't grade a submission in someone else's class", async () => {
    setTestActor({ id: otherTeacher.id, role: "TEACHER" });
    const student = await createStudent(f, { divisionId: otherDivision.id });
    const posted = await createAssignment(assignmentForm(otherDivision.id));
    if (!posted.ok) throw new Error(posted.error);
    const sub = await prisma.submission.findFirstOrThrow({ where: { studentId: student.id } });
    await prisma.submission.update({ where: { id: sub.id }, data: { status: "SUBMITTED", text: "done" } });

    setTestActor({ id: f.teacher.id, role: "TEACHER" });
    const result = await gradeSubmission({ submissionId: sub.id, grade: "A" });

    expect(result.ok).toBe(false);
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } })).grade).toBeNull();
  });

  it("can't publish notes for a subject they don't teach, or delete someone else's", async () => {
    const chem = await prisma.subject.create({ data: { tenantId: f.tenant.id, courseId: f.course.id, name: "Chemistry" } });
    const denied = await createSubjectNote({ courseId: f.course.id, subjectId: chem.id, title: "Moles", kind: "CLASS_NOTES" });
    expect(denied.ok).toBe(false);

    const theirs = await prisma.subjectNote.create({
      data: { tenantId: f.tenant.id, courseId: f.course.id, subjectId: f.subject.id, title: "Theirs", authorId: otherTeacher.id },
    });
    expect((await deleteSubjectNote(theirs.id)).ok).toBe(false);
    expect(await prisma.subjectNote.count()).toBe(1);
  });
});

describe("submissions", () => {
  async function studentWithLogin(divisionId = f.division.id) {
    const user = await prisma.user.create({
      data: { tenantId: f.tenant.id, email: `s${Math.random()}@t.local`, name: "S", passwordHash: "x", role: "STUDENT" },
    });
    const student = await createStudent(f, { divisionId });
    await prisma.student.update({ where: { id: student.id }, data: { userId: user.id } });
    return { student, user };
  }

  function submitForm(submissionId: string, text = "", file?: File) {
    const form = new FormData();
    form.set("submissionId", submissionId);
    form.set("text", text);
    if (file) form.set("file", file);
    return form;
  }

  it("refuses to resubmit once graded, and refuses an empty submission", async () => {
    const { student, user } = await studentWithLogin();
    const posted = await createAssignment(assignmentForm(f.division.id));
    if (!posted.ok) throw new Error(posted.error);
    const sub = await prisma.submission.findFirstOrThrow({ where: { studentId: student.id } });

    setTestActor({ id: user.id, role: "STUDENT" });
    expect((await submitAssignment(submitForm(sub.id, "   "))).ok).toBe(false);
    expect((await submitAssignment(submitForm(sub.id, "My answer"))).ok).toBe(true);

    setTestActor({ id: f.teacher.id, role: "TEACHER" });
    expect((await gradeSubmission({ submissionId: sub.id, grade: "A" })).ok).toBe(true);

    setTestActor({ id: user.id, role: "STUDENT" });
    const again = await submitAssignment(submitForm(sub.id, "Changed my mind"));
    expect(again.ok).toBe(false);
    const row = await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } });
    expect(row.status).toBe("GRADED");
    expect(row.grade).toBe("A");
  });

  it("refuses a file type that isn't coursework", async () => {
    const { student, user } = await studentWithLogin();
    const posted = await createAssignment(assignmentForm(f.division.id));
    if (!posted.ok) throw new Error(posted.error);
    const sub = await prisma.submission.findFirstOrThrow({ where: { studentId: student.id } });

    setTestActor({ id: user.id, role: "STUDENT" });
    const svg = new File(["<svg onload=alert(1)>"], "x.svg", { type: "image/svg+xml" });
    const result = await submitAssignment(submitForm(sub.id, "", svg));

    expect(result.ok).toBe(false);
  });

  it("refuses to grade work that was never handed in", async () => {
    const { student } = await studentWithLogin();
    const posted = await createAssignment(assignmentForm(f.division.id));
    if (!posted.ok) throw new Error(posted.error);
    const sub = await prisma.submission.findFirstOrThrow({ where: { studentId: student.id } });

    expect((await gradeSubmission({ submissionId: sub.id, grade: "F" })).ok).toBe(false);
  });

  it("gives a student admitted after an assignment was posted their copy of it", async () => {
    const posted = await createAssignment(assignmentForm(f.division.id));
    if (!posted.ok) throw new Error(posted.error);

    setTestActor({ id: f.admin.id, role: "SUPER_ADMIN" });
    const admitted = await admitStudent({
      name: "Late Joiner", phone: "9888800001", courseId: f.course.id, divisionId: f.division.id,
      guardianName: "Parent", guardianPhone: "9888800002",
    });
    if (!admitted.ok) throw new Error(admitted.error);

    const subs = await prisma.submission.findMany({ where: { studentId: admitted.data.studentId } });
    expect(subs.map((s) => s.assignmentId)).toEqual([posted.data.id]);
  });

  it("gives a student moved into a division the work already set there", async () => {
    setTestActor({ id: otherTeacher.id, role: "TEACHER" });
    const posted = await createAssignment(assignmentForm(otherDivision.id));
    if (!posted.ok) throw new Error(posted.error);
    const student = await createStudent(f);

    setTestActor({ id: f.admin.id, role: "SUPER_ADMIN" });
    const moved = await reassignStudentDivision({ studentId: student.id, divisionId: otherDivision.id });
    expect(moved.ok).toBe(true);

    expect(await prisma.submission.count({ where: { studentId: student.id, assignmentId: posted.data.id } })).toBe(1);
  });
});

describe("attendance-drop alerts", () => {
  it("warn once a week, not on every absence", async () => {
    const user = await prisma.user.create({
      data: { tenantId: f.tenant.id, email: "absent@t.local", name: "A", passwordHash: "x", role: "STUDENT" },
    });
    const student = await createStudent(f);
    await prisma.student.update({ where: { id: student.id }, data: { userId: user.id } });
    // Five past absences put them well under the threshold.
    for (let i = 1; i <= 5; i++) {
      await prisma.attendance.create({
        data: { tenantId: f.tenant.id, studentId: student.id, divisionId: f.division.id, subjectId: f.subject.id, date: new Date(Date.UTC(2026, 0, i)), status: "ABSENT", markedById: f.teacher.id },
      });
    }
    const today = localDateString();
    await markAttendance({ divisionId: f.division.id, subjectId: f.subject.id, date: today, entries: [{ studentId: student.id, status: "ABSENT" }] });
    await markAttendance({ divisionId: f.division.id, subjectId: f.subject.id, date: today, entries: [{ studentId: student.id, status: "PRESENT" }] });
    await markAttendance({ divisionId: f.division.id, subjectId: f.subject.id, date: today, entries: [{ studentId: student.id, status: "ABSENT" }] });

    expect(await prisma.notification.count({ where: { type: "ATTENDANCE_DROP", recipientId: user.id } })).toBe(1);
  });
});
