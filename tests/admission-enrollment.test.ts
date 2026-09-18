import { beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { admitStudent, convertLead, deleteStudent, uploadKycDocument } from "@/lib/actions/admissions";
import { resolveStoredPath } from "@/lib/storage/paths";
import { kycFileField } from "@/lib/admissions/kyc-files";

let f: Fixture;
const year = new Date().getFullYear();

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
});

function admitInput(overrides: Record<string, string> = {}) {
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

/** The admission the way the browser sends it: fields plus files in one FormData. */
function admitForm(overrides: Record<string, string> = {}, files: Record<string, File> = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(admitInput(overrides))) form.set(k, v);
  for (const [k, v] of Object.entries(files)) form.set(k, v);
  return form;
}

function pdf(name = "doc.pdf", bytes = 512) {
  return new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
}

async function readyLead(overrides: Partial<{ email: string | null; phone: string }> = {}) {
  return prisma.lead.create({
    data: {
      tenantId: f.tenant.id,
      name: "Arjun Mehta",
      phone: overrides.phone ?? "+91 91111 22222",
      email: overrides.email === undefined ? "arjun@example.com" : overrides.email,
      source: "WEB",
      interestedCourseId: f.course.id,
      status: "READY",
      assignedCounselorId: f.counselor.id,
    },
  });
}

describe("enrollment numbers", () => {
  it("keeps issuing new numbers after a student is deleted", async () => {
    const first = await admitStudent(admitInput());
    const second = await admitStudent(admitInput({ name: "Second", guardianPhone: "+91 90000 33333" }));
    if (!first.ok || !second.ok) throw new Error("setup admissions failed");
    expect(second.data.enrollmentNumber).toBe(`${year}-0002`);

    // Deleting a student used to make every later admission collide with the
    // survivor's number — the count went down, the highest number didn't.
    const removed = await deleteStudent(first.data.studentId);
    expect(removed.ok).toBe(true);

    const third = await admitStudent(admitInput({ name: "Third", guardianPhone: "+91 90000 44444" }));
    expect(third.ok).toBe(true);
    if (third.ok) expect(third.data.enrollmentNumber).toBe(`${year}-0003`);
  });

  it("continues from the highest number already issued this year, whatever the row count", async () => {
    await createStudent(f, { enrollmentNumber: `${year}-0041` });
    await createStudent(f, { enrollmentNumber: "LEGACY-2025-0001" });

    const result = await admitStudent(admitInput());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.enrollmentNumber).toBe(`${year}-0042`);
  });
});

describe("portal login emails", () => {
  it("gives the student a generated login when their email is the guardian's too", async () => {
    // A parent typing their own address into both fields is the everyday case
    // that used to fail the whole admission with a unique-constraint error.
    const result = await admitStudent(admitInput({ email: "parent@example.com", guardianEmail: "parent@example.com" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.guardianLogin?.email).toBe("parent@example.com");
    expect(result.data.studentLogin.email).toBe(`${result.data.enrollmentNumber}@student.test`);
    expect(result.data.notes.length).toBeGreaterThan(0);
  });

  it("falls back to a generated guardian login when the guardian's email already belongs to someone", async () => {
    const result = await admitStudent(admitInput({ guardianEmail: "teacher@test.local" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.guardianLogin?.email).toBe(`${result.data.enrollmentNumber}.parent@guardian.test`);
    // The staff account is untouched.
    const teacher = await prisma.user.findUniqueOrThrow({ where: { id: f.teacher.id } });
    expect(teacher.role).toBe("TEACHER");
  });

  it("stores emails lowercased so sign-in can find them", async () => {
    const result = await admitStudent(admitInput({ email: "Kabir.Joshi@Example.COM", guardianEmail: "Latha@Example.COM" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.studentLogin.email).toBe("kabir.joshi@example.com");
    expect(result.data.guardianLogin?.email).toBe("latha@example.com");
    expect(await prisma.user.count({ where: { email: "kabir.joshi@example.com" } })).toBe(1);
  });

  it("reuses a guardian whose phone is written differently", async () => {
    await admitStudent(admitInput());
    const sibling = await admitStudent(admitInput({ name: "Sibling Joshi", guardianPhone: "9000022222" }));

    expect(sibling.ok).toBe(true);
    expect(await prisma.parentGuardian.count({ where: { tenantId: f.tenant.id } })).toBe(1);
    if (sibling.ok) expect(sibling.data.guardianLogin).toBeNull();
  });
});

describe("KYC documents handed over at admission", () => {
  it("files each document against the checklist as submitted, leaving the rest pending", async () => {
    const result = await admitStudent(
      admitForm({}, { [kycFileField("ID_PROOF")]: pdf("aadhaar.pdf"), [kycFileField("PHOTO")]: new File([new Uint8Array(64)], "me.png", { type: "image/png" }) }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const docs = await prisma.kycDocument.findMany({ where: { studentId: result.data.studentId }, orderBy: { docType: "asc" } });
    const byType = Object.fromEntries(docs.map((d) => [d.docType, d]));
    expect(byType.ID_PROOF.status).toBe("SUBMITTED");
    expect(byType.ID_PROOF.fileUrl).toMatch(/\/kyc\/.+\.pdf$/);
    expect(byType.PHOTO.status).toBe("SUBMITTED");
    expect(byType.PHOTO.fileUrl).toMatch(/\.png$/);
    expect(byType.ADDRESS_PROOF.status).toBe("PENDING");
    expect(byType.ADDRESS_PROOF.fileUrl).toBeNull();
    expect(byType.PREVIOUS_MARKSHEET.status).toBe("PENDING");

    // The URL resolves to the bytes that were uploaded.
    const onDisk = resolveStoredPath(byType.ID_PROOF.fileUrl!.replace("/api/storage/", "").split("/"));
    expect((await readFile(onDisk!)).byteLength).toBe(512);

    const uploads = await prisma.auditLog.count({ where: { entityType: "KycDocument", action: "UPLOAD" } });
    expect(uploads).toBe(2);
  });

  it("still admits with no documents attached, exactly as before", async () => {
    const result = await admitStudent(admitForm());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const docs = await prisma.kycDocument.findMany({ where: { studentId: result.data.studentId } });
    expect(docs).toHaveLength(4);
    expect(docs.every((d) => d.status === "PENDING" && d.fileUrl === null)).toBe(true);
  });

  it("rejects a document that isn't a PDF or image and writes nothing", async () => {
    const exe = new File([new Uint8Array(16)], "setup.exe", { type: "application/x-msdownload" });
    const result = await admitStudent(admitForm({}, { [kycFileField("ID_PROOF")]: exe }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/PDF or an image/);
    expect(await prisma.student.count()).toBe(0);
    expect(await prisma.user.count({ where: { role: "STUDENT" } })).toBe(0);
  });

  it("rejects the same file types on the later per-document upload", async () => {
    const admitted = await admitStudent(admitInput());
    if (!admitted.ok) throw new Error(admitted.error);
    const doc = await prisma.kycDocument.findFirstOrThrow({ where: { studentId: admitted.data.studentId, docType: "ID_PROOF" } });

    const form = new FormData();
    form.set("studentId", admitted.data.studentId);
    form.set("kycDocumentId", doc.id);
    form.set("file", new File([new Uint8Array(16)], "x.html", { type: "text/html" }));

    const result = await uploadKycDocument(form);
    expect(result.ok).toBe(false);
    expect((await prisma.kycDocument.findUniqueOrThrow({ where: { id: doc.id } })).status).toBe("PENDING");
  });
});

describe("convertLead", () => {
  it("converts a ready lead into a student with documents attached", async () => {
    setTestActor({ id: f.admissions.id, role: "ADMISSION_OFFICER" });
    const lead = await readyLead();
    const form = new FormData();
    form.set("leadId", lead.id);
    form.set("courseId", f.course.id);
    form.set("divisionId", f.division.id);
    form.set("dob", "2008-05-10");
    form.set("address", "12 MG Road");
    form.set("guardianName", "Sunita Mehta");
    form.set("guardianPhone", "+91 92222 33333");
    form.set("guardianEmail", "");
    form.set("guardianRelationship", "Mother");
    form.set(kycFileField("ADDRESS_PROOF"), pdf("bill.pdf"));

    const result = await convertLead(form);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const student = await prisma.student.findUniqueOrThrow({ where: { id: result.data.studentId } });
    expect(student.convertedFromLeadId).toBe(lead.id);
    expect(student.email).toBe("arjun@example.com");
    expect(result.data.studentLogin.email).toBe("arjun@example.com");
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("CONVERTED");
    const proof = await prisma.kycDocument.findFirstOrThrow({ where: { studentId: student.id, docType: "ADDRESS_PROOF" } });
    expect(proof.status).toBe("SUBMITTED");
    expect(await prisma.feePlan.count({ where: { studentId: student.id } })).toBe(1);
  });

  it("succeeds when the lead's email is the guardian's email", async () => {
    const lead = await readyLead({ email: "family@example.com" });

    const result = await convertLead({
      leadId: lead.id,
      courseId: f.course.id,
      divisionId: f.division.id,
      guardianName: "Sunita Mehta",
      guardianPhone: "+91 92222 33333",
      guardianEmail: "family@example.com",
      guardianRelationship: "Mother",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.guardianLogin?.email).toBe("family@example.com");
    expect(result.data.studentLogin.email).toBe(`${result.data.enrollmentNumber}@student.test`);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("CONVERTED");
  });

  it("refuses a lead that is already converted, and leaves the lead alone on any failure", async () => {
    const lead = await readyLead();
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "CONVERTED" } });

    const result = await convertLead({
      leadId: lead.id,
      courseId: f.course.id,
      divisionId: f.division.id,
      guardianName: "Sunita Mehta",
      guardianPhone: "+91 92222 33333",
    });

    expect(result.ok).toBe(false);
    expect(await prisma.student.count()).toBe(0);
  });
});
