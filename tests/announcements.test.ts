import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, seedFixture, type Fixture } from "./helpers/db";
import { setTestActor } from "./helpers/actor";
import { createAnnouncement, updateAnnouncement, deleteAnnouncement } from "@/lib/actions/announcements";

let f: Fixture;

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
});

async function makeAnnouncement(title = "Diwali break") {
  const result = await createAnnouncement({ title, body: "Institute closed 20-24 Oct.", audience: "EVERYONE" });
  if (!result.ok) throw new Error(result.error);
  return result.data.id;
}

describe("updateAnnouncement", () => {
  it("edits title, body and audience", async () => {
    const id = await makeAnnouncement();

    const result = await updateAnnouncement(id, {
      title: "Diwali break (revised)",
      body: "Closed 20-26 Oct.",
      audience: "PARENTS",
    });

    expect(result.ok).toBe(true);
    const row = await prisma.announcement.findUniqueOrThrow({ where: { id } });
    expect(row.title).toBe("Diwali break (revised)");
    expect(row.body).toBe("Closed 20-26 Oct.");
    expect(row.audience).toBe("PARENTS");
  });

  it("records an audit entry naming the announcement", async () => {
    const id = await makeAnnouncement();

    await updateAnnouncement(id, { title: "New title", body: "New body", audience: "TEACHERS" });

    const log = await prisma.auditLog.findFirst({
      where: { tenantId: f.tenant.id, entityType: "Announcement", entityId: id, action: "UPDATE" },
    });
    expect(log).not.toBeNull();
    expect(log!.actorId).toBe(f.admin.id);
  });

  it("rejects invalid input without touching the row", async () => {
    const id = await makeAnnouncement();

    const result = await updateAnnouncement(id, { title: "x", body: "New body", audience: "EVERYONE" });

    expect(result.ok).toBe(false);
    const row = await prisma.announcement.findUniqueOrThrow({ where: { id } });
    expect(row.title).toBe("Diwali break");
  });

  it("refuses an announcement belonging to another tenant", async () => {
    const other = await prisma.tenant.create({ data: { name: "Other", subdomain: "other" } });
    const otherUser = await prisma.user.create({
      data: { tenantId: other.id, email: "a@other.local", name: "A", passwordHash: "x", role: "SUPER_ADMIN" },
    });
    const foreign = await prisma.announcement.create({
      data: { tenantId: other.id, title: "Theirs", body: "Not yours", audience: "EVERYONE", authorId: otherUser.id },
    });

    const result = await updateAnnouncement(foreign.id, { title: "Hijacked", body: "Hijacked body", audience: "EVERYONE" });

    expect(result.ok).toBe(false);
    const row = await prisma.announcement.findUniqueOrThrow({ where: { id: foreign.id } });
    expect(row.title).toBe("Theirs");
  });

  it("is denied to roles without announcement:manage", async () => {
    const id = await makeAnnouncement();
    setTestActor({ id: f.finance.id, role: "FINANCE" });

    const result = await updateAnnouncement(id, { title: "Finance edit", body: "Nope", audience: "EVERYONE" });

    expect(result.ok).toBe(false);
    const row = await prisma.announcement.findUniqueOrThrow({ where: { id } });
    expect(row.title).toBe("Diwali break");
  });
});

describe("existing announcement actions still behave", () => {
  it("creates and deletes", async () => {
    const id = await makeAnnouncement("Sports day");
    expect(await prisma.announcement.count()).toBe(1);

    const result = await deleteAnnouncement(id);

    expect(result.ok).toBe(true);
    expect(await prisma.announcement.count()).toBe(0);
  });
});
