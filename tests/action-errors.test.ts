import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { resetDb, seedFixture, type Fixture } from "./helpers/db";
import { actionError } from "@/lib/actions/types";
import { BusinessRuleError } from "@/lib/actions/errors";
import { ForbiddenError, UnauthorizedError } from "@/lib/rbac/errors";
import { loadActor, sessionRejectionReason } from "@/lib/rbac/actor";

describe("actionError", () => {
  it("turns a validation failure into one labelled sentence, not a JSON dump", () => {
    const schema = z.object({ guardianPhone: z.string().min(10) });
    let thrown: unknown;
    try {
      schema.parse({ guardianPhone: "123" });
    } catch (error) {
      thrown = error;
    }

    const result = actionError(thrown);

    expect(result.ok).toBe(false);
    const message = (result as { error: string }).error;
    expect(message).toContain("Guardian phone");
    expect(message).not.toContain("{");
    expect(message).not.toContain("too_small");
  });

  it("keeps a business rule's own wording", () => {
    const result = actionError(new BusinessRuleError("This payment has already been corrected."));
    expect(result).toEqual({ ok: false, error: "This payment has already been corrected." });
  });

  it("keeps the guards' wording", () => {
    expect(actionError(new ForbiddenError("Missing permission: payment:create"))).toEqual({
      ok: false,
      error: "Missing permission: payment:create",
    });
    expect(actionError(new UnauthorizedError("This account has been deactivated."))).toEqual({
      ok: false,
      error: "This account has been deactivated.",
    });
  });

  it("never forwards a database error's internals", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Invalid `prisma.user.create()` invocation\n\nUnique constraint failed on the fields: (`tenantId`,`email`)',
      { code: "P2002", clientVersion: "7.0.0" },
    );

    const message = (actionError(error) as { error: string }).error;

    expect(message).not.toContain("prisma.user.create");
    expect(message).not.toContain("tenantId");
    expect(message).toMatch(/unique/i);
  });

  it("hides an unexpected error behind a generic message but logs it", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const leak = new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2");

    const message = (actionError(leak) as { error: string }).error;

    expect(message).toBe("Something went wrong. Please try again.");
    expect(message).not.toContain("hunter2");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("session revocation", () => {
  let f: Fixture;

  beforeEach(async () => {
    await resetDb();
    f = await seedFixture();
  });

  it("reports a deactivated account as unusable", async () => {
    await prisma.user.update({ where: { id: f.teacher.id }, data: { isActive: false } });

    const actor = await loadActor(f.tenant.id, f.teacher.id);

    expect(sessionRejectionReason(actor)).toBe("This account has been deactivated.");
  });

  it("accepts an active account", async () => {
    const actor = await loadActor(f.tenant.id, f.teacher.id);
    expect(sessionRejectionReason(actor)).toBeNull();
  });

  it("reports a deleted account as unusable", async () => {
    expect(sessionRejectionReason(await loadActor(f.tenant.id, "does-not-exist"))).toBe(
      "This account no longer exists.",
    );
  });

  it("refuses a user from another tenant", async () => {
    const other = await prisma.tenant.create({ data: { name: "Other", subdomain: "other-rev" } });

    // Right user id, wrong institute: the session must not resolve.
    expect(await loadActor(other.id, f.admin.id)).toBeNull();
  });

  it("reports the role the database holds now, not the one in the token", async () => {
    await prisma.user.update({ where: { id: f.admin.id }, data: { role: "TEACHER" } });

    const actor = await loadActor(f.tenant.id, f.admin.id);

    expect(actor!.role).toBe("TEACHER");
  });
});
