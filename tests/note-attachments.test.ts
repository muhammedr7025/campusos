import { beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, createStudent, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { createSubjectNote } from "@/lib/actions/notes";
import { canReadStoredFile } from "@/lib/storage/access";
import { resolveStoredPath, STORAGE_ROOT, storageUrl } from "@/lib/storage/paths";

let f: Fixture;

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
  setTestActor({ id: f.teacher.id, role: "TEACHER" });
});

/** A file the way the browser sends one: a real File in FormData. */
function noteForm(file?: File) {
  const form = new FormData();
  form.set("courseId", f.course.id);
  form.set("subjectId", f.subject.id);
  form.set("title", "Kinematics chapter 1");
  form.set("kind", "CLASS_NOTES");
  form.set("text", "");
  form.set("pages", "");
  if (file) form.set("file", file);
  return form;
}

function pdf(bytes = 1024, name = "kinematics.pdf") {
  return new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
}

describe("createSubjectNote with an attachment", () => {
  it("stores the file and records a URL that points at it", async () => {
    const result = await createSubjectNote(noteForm(pdf()));

    expect(result.ok).toBe(true);
    const note = await prisma.subjectNote.findFirstOrThrow({ where: { tenantId: f.tenant.id } });
    expect(note.fileUrl).toMatch(/^\/api\/storage\//);

    // The whole bug was the writer and the reader disagreeing about where
    // files live — so assert the URL actually resolves to bytes on disk.
    const segments = note.fileUrl!.replace("/api/storage/", "").split("/");
    const onDisk = resolveStoredPath(segments);
    expect(onDisk).not.toBeNull();
    expect((await readFile(onDisk!)).byteLength).toBe(1024);
  });

  it("files the attachment under the tenant and the notes category", async () => {
    await createSubjectNote(noteForm(pdf()));

    const note = await prisma.subjectNote.findFirstOrThrow({ where: { tenantId: f.tenant.id } });
    expect(note.fileUrl!.startsWith(storageUrl([f.tenant.id, "notes"]))).toBe(true);
  });

  it("keeps the extension so the browser gets the right content type", async () => {
    await createSubjectNote(noteForm(pdf()));

    const note = await prisma.subjectNote.findFirstOrThrow({ where: { tenantId: f.tenant.id } });
    expect(path.extname(note.fileUrl!)).toBe(".pdf");
  });

  it("rejects a file type that isn't a PDF or an image, and writes no note", async () => {
    const result = await createSubjectNote(noteForm(new File(["x"], "notes.exe", { type: "application/x-msdownload" })));

    expect(result.ok).toBe(false);
    expect(await prisma.subjectNote.count()).toBe(0);
  });

  it("rejects a file over the 20 MB limit", async () => {
    const result = await createSubjectNote(noteForm(pdf(21 * 1024 * 1024)));

    expect(result.ok).toBe(false);
    expect(await prisma.subjectNote.count()).toBe(0);
  });

  it("still publishes a note with no attachment at all", async () => {
    const result = await createSubjectNote(noteForm());

    expect(result.ok).toBe(true);
    const note = await prisma.subjectNote.findFirstOrThrow({ where: { tenantId: f.tenant.id } });
    expect(note.fileUrl).toBeNull();
  });

  it("records in the audit trail whether a file came with the note", async () => {
    await createSubjectNote(noteForm(pdf()));

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { tenantId: f.tenant.id, entityType: "SubjectNote", action: "CREATE" },
    });
    expect((log.diff as { hasFile: boolean }).hasFile).toBe(true);
  });
});

describe("resolveStoredPath", () => {
  it("resolves an ordinary path inside the storage root", () => {
    expect(resolveStoredPath(["tenant", "notes", "a.pdf"])).toBe(path.join(STORAGE_ROOT, "tenant/notes/a.pdf"));
  });

  it("refuses to climb out of the storage root", () => {
    expect(resolveStoredPath(["..", "..", "etc", "passwd"])).toBeNull();
    expect(resolveStoredPath(["tenant", "..", "..", "secrets.env"])).toBeNull();
  });

  it("refuses empty segments and null bytes", () => {
    expect(resolveStoredPath([])).toBeNull();
    expect(resolveStoredPath(["tenant", "", "a.pdf"])).toBeNull();
    expect(resolveStoredPath(["tenant\0", "a.pdf"])).toBeNull();
  });
});

describe("canReadStoredFile — the notes fee lock", () => {
  async function publishNote() {
    await createSubjectNote(noteForm(pdf()));
    const note = await prisma.subjectNote.findFirstOrThrow({ where: { tenantId: f.tenant.id } });
    return note.fileUrl!;
  }

  async function studentWithBalance(balance: number) {
    const user = await prisma.user.create({
      data: {
        tenantId: f.tenant.id,
        email: `s-${Math.random().toString(36).slice(2, 8)}@test.local`,
        name: "Riya",
        passwordHash: "x",
        role: "STUDENT",
      },
    });
    const student = await createStudent(f);
    await prisma.student.update({ where: { id: student.id }, data: { userId: user.id } });
    const plan = await prisma.feePlan.create({
      data: {
        tenantId: f.tenant.id,
        studentId: student.id,
        feeStructureId: f.feeStructure.id,
        totalAmount: 60000,
        installments: {
          create: [{ label: "One", amount: 60000, sequence: 1, dueDate: new Date("2026-01-15") }],
        },
      },
    });
    if (balance < 60000) {
      await prisma.payment.create({
        data: {
          tenantId: f.tenant.id,
          studentId: student.id,
          feePlanId: plan.id,
          amount: 60000 - balance,
          mode: "UPI",
          paidAt: new Date("2026-01-10"),
          collectedById: f.finance.id,
        },
      });
    }
    return { user, student };
  }

  it("lets a fee-clear student open the attachment", async () => {
    const url = await publishNote();
    const { user } = await studentWithBalance(0);

    const allowed = await canReadStoredFile({
      tenantId: f.tenant.id,
      category: "notes",
      url,
      viewer: { id: user.id, role: "STUDENT" },
    });
    expect(allowed).toBe(true);
  });

  it("blocks a student who still owes money, even with the direct URL", async () => {
    const url = await publishNote();
    const { user } = await studentWithBalance(20000);

    const allowed = await canReadStoredFile({
      tenantId: f.tenant.id,
      category: "notes",
      url,
      viewer: { id: user.id, role: "STUDENT" },
    });
    expect(allowed).toBe(false);
  });

  it("never locks a parent out", async () => {
    const url = await publishNote();
    const guardian = await prisma.user.create({
      data: { tenantId: f.tenant.id, email: "p@test.local", name: "Parent", passwordHash: "x", role: "PARENT" },
    });

    const allowed = await canReadStoredFile({
      tenantId: f.tenant.id,
      category: "notes",
      url,
      viewer: { id: guardian.id, role: "PARENT" },
    });
    expect(allowed).toBe(true);
  });

  it("blocks a fee-clear student enrolled on a different course", async () => {
    const url = await publishNote();
    const { user, student } = await studentWithBalance(0);
    const otherCourse = await prisma.course.create({
      data: { tenantId: f.tenant.id, batchId: f.batch.id, name: "JEE Foundation", durationLabel: "12 months" },
    });
    await prisma.student.update({ where: { id: student.id }, data: { courseId: otherCourse.id, divisionId: null } });

    const allowed = await canReadStoredFile({
      tenantId: f.tenant.id,
      category: "notes",
      url,
      viewer: { id: user.id, role: "STUDENT" },
    });
    expect(allowed).toBe(false);
  });

  it("denies a notes URL that matches no note at all", async () => {
    await publishNote();
    const { user } = await studentWithBalance(0);

    const allowed = await canReadStoredFile({
      tenantId: f.tenant.id,
      category: "notes",
      url: storageUrl([f.tenant.id, "notes", "made-up.pdf"]),
      viewer: { id: user.id, role: "STUDENT" },
    });
    expect(allowed).toBe(false);
  });

  it("leaves other categories to the caller's tenant check", async () => {
    const allowed = await canReadStoredFile({
      tenantId: f.tenant.id,
      category: "assignments",
      url: storageUrl([f.tenant.id, "assignments", "x.pdf"]),
      viewer: { id: f.teacher.id, role: "TEACHER" },
    });
    expect(allowed).toBe(true);
  });
});
