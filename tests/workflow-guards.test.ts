import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { changeLeadStage, createLead, logFollowUp, updateLead } from "@/lib/actions/leads";
import { deleteDivision, deleteSubject, updateDivision } from "@/lib/actions/academic";
import { decideDiscount, requestDiscount } from "@/lib/actions/discounts";
import { updateAdmissionSettings, uploadBrandingAsset, updateBranding } from "@/lib/actions/tenant";
import { admitStudent, setKycStatus, updateGuardian } from "@/lib/actions/admissions";
import { runScheduledNotifications } from "@/lib/notifications/scheduled";

let f: Fixture;

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
});

const lead = (status: "NEW" | "FOLLOW_UP" | "CONVERTED" | "LOST" = "NEW", phone = "9876500001") =>
  prisma.lead.create({ data: { tenantId: f.tenant.id, name: "Asha", phone, status, assignedCounselorId: f.counselor.id } });

describe("the enquiry pipeline", () => {
  beforeEach(() => setTestActor({ id: f.counselor.id, role: "COUNSELOR" }));

  it("won't drag a converted enquiry back onto the board", async () => {
    const l = await lead("CONVERTED");
    expect((await changeLeadStage({ leadId: l.id, status: "INTERESTED" })).ok).toBe(false);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("CONVERTED");
  });

  it("reopens a lost enquiry and clears the lost reason", async () => {
    const l = await lead("LOST");
    await prisma.lead.update({ where: { id: l.id }, data: { lostReason: "Too far" } });
    expect((await changeLeadStage({ leadId: l.id, status: "CONTACTED" })).ok).toBe(true);
    const row = await prisma.lead.findUniqueOrThrow({ where: { id: l.id } });
    expect(row.status).toBe("CONTACTED");
    expect(row.lostReason).toBeNull();
  });

  it("refuses edits and follow-ups on a converted enquiry", async () => {
    const l = await lead("CONVERTED");
    expect((await logFollowUp({ leadId: l.id, type: "CALL", completedNow: true })).ok).toBe(false);
    expect((await updateLead(l.id, { name: "New name", phone: "9876500001", source: "WEB" })).ok).toBe(false);
  });

  it("doesn't move a follow-up-stage enquiry backwards when a follow-up is logged", async () => {
    const l = await lead("FOLLOW_UP");
    await logFollowUp({ leadId: l.id, type: "CALL", completedNow: true });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("FOLLOW_UP");
  });

  it("refuses a second enquiry for a phone number already in the pipeline, however it's written", async () => {
    await lead("NEW", "+91 98765 00001");
    const dup = await createLead({ name: "Asha again", phone: "9876500001", source: "WALK_IN" });
    expect(dup.ok).toBe(false);
    expect(await prisma.lead.count()).toBe(1);
  });

  it("refuses an enquiry for someone who is already a student", async () => {
    const s = await createStudent(f);
    await prisma.student.update({ where: { id: s.id }, data: { phone: "9876512345" } });
    expect((await createLead({ name: "Riya", phone: "+91-98765-12345", source: "PHONE" })).ok).toBe(false);
  });
});

describe("academic structure guards", () => {
  it("won't delete a subject that has exams or notes", async () => {
    await prisma.exam.create({
      data: { tenantId: f.tenant.id, divisionId: f.division.id, subjectId: f.subject.id, name: "Midterm", date: new Date(), maxMarks: 100, createdById: f.teacher.id },
    });
    await prisma.timetable.deleteMany({});
    const result = await deleteSubject(f.subject.id);
    expect(result.ok).toBe(false);
    expect(await prisma.subject.count({ where: { id: f.subject.id } })).toBe(1);
  });

  it("won't delete a division that still has a timetable", async () => {
    const result = await deleteDivision(f.division.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("timetable");
  });

  it("won't move a division with students to another course, or shrink it below its roster", async () => {
    await createStudent(f);
    await createStudent(f);
    const other = await prisma.course.create({ data: { tenantId: f.tenant.id, batchId: f.batch.id, name: "JEE" } });

    expect((await updateDivision(f.division.id, { courseId: other.id, name: "Morning A", capacity: 40 })).ok).toBe(false);
    expect((await updateDivision(f.division.id, { courseId: f.course.id, name: "Morning A", capacity: 1 })).ok).toBe(false);
    expect((await updateDivision(f.division.id, { courseId: f.course.id, name: "Morning A+", capacity: 2 })).ok).toBe(true);
  });
});

describe("discount approval", () => {
  it("fails loudly for a student with no fee plan", async () => {
    const s = await createStudent(f);
    setTestActor({ id: f.finance.id, role: "FINANCE" });
    const req = await requestDiscount({ studentId: s.id, kind: "Scholarship", amount: 5000, reason: "Merit" });
    if (!req.ok) throw new Error(req.error);

    setTestActor({ id: f.admin.id, role: "SUPER_ADMIN" });
    const decided = await decideDiscount(req.data.id, true);
    expect(decided.ok).toBe(false);
    expect((await prisma.discountRequest.findUniqueOrThrow({ where: { id: req.data.id } })).status).toBe("PENDING");
  });

  it("refuses a discount larger than what's still owed", async () => {
    const s = await createStudent(f);
    await prisma.feePlan.create({
      data: { tenantId: f.tenant.id, studentId: s.id, totalAmount: 10000, installments: { create: [{ label: "One", amount: 10000, sequence: 1, dueDate: new Date("2030-01-01") }] } },
    });
    setTestActor({ id: f.finance.id, role: "FINANCE" });
    const req = await requestDiscount({ studentId: s.id, kind: "Hardship waiver", amount: 15000, reason: "Too much" });
    if (!req.ok) throw new Error(req.error);
    setTestActor({ id: f.admin.id, role: "SUPER_ADMIN" });
    expect((await decideDiscount(req.data.id, true)).ok).toBe(false);
  });
});

describe("configurable KYC and guardians", () => {
  const admit = (o: Record<string, string> = {}) =>
    admitStudent({ name: "Kavya", phone: "9000011111", courseId: f.course.id, divisionId: f.division.id, guardianName: "Ravi", guardianPhone: "9000022222", ...o });

  it("marks only the institute's mandatory documents as required", async () => {
    expect((await updateAdmissionSettings({ requiredKycDocs: ["ID_PROOF", "PHOTO"] })).ok).toBe(true);
    const result = await admit();
    if (!result.ok) throw new Error(result.error);

    const docs = await prisma.kycDocument.findMany({ where: { studentId: result.data.studentId } });
    expect(docs).toHaveLength(4);
    expect(docs.filter((d) => d.required).map((d) => d.docType).sort()).toEqual(["ID_PROOF", "PHOTO"]);

    for (const d of docs.filter((d) => d.required)) {
      await prisma.kycDocument.update({ where: { id: d.id }, data: { status: "SUBMITTED" } });
      await setKycStatus({ kycDocumentId: d.id, status: "VERIFIED" });
    }
    expect((await prisma.student.findUniqueOrThrow({ where: { id: result.data.studentId } })).status).toBe("ACTIVE");
  });

  it("admits straight to active when nothing is mandatory, and promotes waiting students when the rule relaxes", async () => {
    const waiting = await admit();
    if (!waiting.ok) throw new Error(waiting.error);

    const saved = await updateAdmissionSettings({ requiredKycDocs: [] });
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.data.promoted).toBe(1);
    expect((await prisma.student.findUniqueOrThrow({ where: { id: waiting.data.studentId } })).status).toBe("ACTIVE");

    const fresh = await admit({ name: "Next", phone: "9000033333", guardianPhone: "9000044444" });
    if (!fresh.ok) throw new Error(fresh.error);
    expect((await prisma.student.findUniqueOrThrow({ where: { id: fresh.data.studentId } })).status).toBe("ACTIVE");
  });

  it("stamps the guardian as invited when their credentials are issued at the desk", async () => {
    const result = await admit();
    if (!result.ok) throw new Error(result.error);
    const parent = await prisma.user.findFirstOrThrow({ where: { email: result.data.guardianLogin!.email } });
    expect(parent.lastInviteSentAt).not.toBeNull();
  });

  it("edits a guardian and keeps their portal account in step", async () => {
    const result = await admit({ guardianEmail: "ravi@example.com" });
    if (!result.ok) throw new Error(result.error);
    const guardian = await prisma.parentGuardian.findFirstOrThrow({ where: { phone: "9000022222" } });

    const updated = await updateGuardian(guardian.id, { name: "Ravi Kumar", phone: "9000099999", email: "Ravi.K@Example.com", relationship: "Father" });

    expect(updated.ok).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: guardian.userId! } });
    expect(user.name).toBe("Ravi Kumar");
    expect(user.phone).toBe("9000099999");
    expect(user.email).toBe("ravi.k@example.com");
  });
});

describe("branding", () => {
  it("refuses an SVG logo and a pasted outside URL", async () => {
    const form = new FormData();
    form.set("file", new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }));
    expect((await uploadBrandingAsset(form)).ok).toBe(false);

    const branding = await updateBranding({ name: "Test Institute", logoUrl: "https://evil.example/x.png", primaryColor: "#123456", secondaryColor: "#ffffff", accentColor: "#000000" });
    expect(branding.ok).toBe(false);
  });
});

describe("scheduled reminders", () => {
  const DAY = 86_400_000;

  async function familyOwing(dueInDays: number) {
    const user = await prisma.user.create({ data: { tenantId: f.tenant.id, email: `k${Math.random()}@t.local`, name: "K", passwordHash: "x", role: "STUDENT" } });
    const s = await createStudent(f, { name: "Owing Student" });
    await prisma.student.update({ where: { id: s.id }, data: { userId: user.id } });
    await prisma.feePlan.create({
      data: {
        tenantId: f.tenant.id, studentId: s.id, feeStructureId: f.feeStructure.id, totalAmount: 20000,
        installments: { create: [{ label: "Term 1", amount: 20000, sequence: 1, dueDate: new Date(Date.now() + dueInDays * DAY) }] },
      },
    });
    return { user, s };
  }

  it("sends fee-due and fee-overdue reminders once, not on every run", async () => {
    const soon = await familyOwing(2);
    const late = await familyOwing(-10);

    const first = await runScheduledNotifications(f.tenant.id);
    const second = await runScheduledNotifications(f.tenant.id);

    expect(first.FEE_DUE).toBe(1);
    expect(first.FEE_OVERDUE).toBe(1);
    expect(second.FEE_DUE + second.FEE_OVERDUE).toBe(0);
    expect(await prisma.notification.count({ where: { recipientId: soon.user.id, type: "FEE_DUE" } })).toBe(1);
    expect(await prisma.notification.count({ where: { recipientId: late.user.id, type: "FEE_OVERDUE" } })).toBe(1);
  });

  it("sends each reminder once even when several runs overlap", async () => {
    // Several page loads at once each kick off a run — this is how the first
    // version of the reminders sent four copies of every overdue notice.
    const late = await familyOwing(-10);

    await Promise.all([1, 2, 3, 4].map(() => runScheduledNotifications(f.tenant.id)));

    expect(await prisma.notification.count({ where: { recipientId: late.user.id, type: "FEE_OVERDUE" } })).toBe(1);
  });

  it("reminds the counselor about a due follow-up, and admissions about stale KYC", async () => {
    const l = await lead("FOLLOW_UP");
    await prisma.followUp.create({ data: { tenantId: f.tenant.id, leadId: l.id, type: "CALL", scheduledAt: new Date(Date.now() - DAY), createdById: f.counselor.id } });
    const s = await createStudent(f, { status: "KYC_PENDING" });
    await prisma.student.update({ where: { id: s.id }, data: { createdAt: new Date(Date.now() - 10 * DAY) } });
    await prisma.kycDocument.create({ data: { tenantId: f.tenant.id, studentId: s.id, docType: "ID_PROOF", required: true } });

    const sent = await runScheduledNotifications(f.tenant.id);

    expect(sent.FOLLOW_UP_DUE).toBe(1);
    expect(await prisma.notification.count({ where: { recipientId: f.counselor.id, type: "FOLLOW_UP_DUE" } })).toBe(1);
    expect(await prisma.notification.count({ where: { recipientId: f.admissions.id, type: "KYC_PENDING" } })).toBe(1);
  });

  it("warns about an assignment due within two days that hasn't been handed in", async () => {
    const user = await prisma.user.create({ data: { tenantId: f.tenant.id, email: "hw@t.local", name: "HW", passwordHash: "x", role: "STUDENT" } });
    const s = await createStudent(f);
    await prisma.student.update({ where: { id: s.id }, data: { userId: user.id } });
    const a = await prisma.assignment.create({
      data: { tenantId: f.tenant.id, divisionId: f.division.id, subjectId: f.subject.id, teacherId: f.teacher.id, title: "Essay", dueDate: new Date(Date.now() + DAY) },
    });
    await prisma.submission.create({ data: { tenantId: f.tenant.id, assignmentId: a.id, studentId: s.id } });

    const sent = await runScheduledNotifications(f.tenant.id);

    expect(sent.ASSIGNMENT_DUE_SOON).toBe(1);
  });
});
