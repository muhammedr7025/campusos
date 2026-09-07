import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ForbiddenError, UnauthorizedError } from "@/lib/rbac/errors";
import { BusinessRuleError } from "@/lib/actions/errors";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const GENERIC = "Something went wrong. Please try again.";

/** "guardianPhone" -> "Guardian phone", so a field name reads like a label. */
function humanizePath(path: PropertyKey[]): string | null {
  const field = path.filter((p) => typeof p === "string").join(" ");
  if (!field) return null;
  const spaced = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.]/g, " ")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Turns whatever an action threw into one sentence a user can act on.
 *
 * The messages these errors carry are not fit to show anyone: a ZodError's
 * `.message` is a JSON dump of its issues, and a Prisma error names the
 * query, the table and the columns involved. Both used to be forwarded
 * straight into a toast.
 */
export function actionError(error: unknown): ActionResult<never> {
  // Deliberate, already-user-facing messages: our own guards and rules.
  if (
    error instanceof UnauthorizedError ||
    error instanceof ForbiddenError ||
    error instanceof BusinessRuleError
  ) {
    return { ok: false, error: error.message };
  }

  if (error instanceof ZodError) {
    const issue = error.issues[0];
    if (!issue) return { ok: false, error: "Please check the form and try again." };
    const label = humanizePath(issue.path);
    return { ok: false, error: label ? `${label}: ${issue.message}` : issue.message };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return { ok: false, error: "That already exists — the value has to be unique." };
      case "P2003":
        return { ok: false, error: "Something this depends on is missing or already removed." };
      case "P2025":
        return { ok: false, error: "That record no longer exists. Refresh and try again." };
      default:
        break;
    }
  }

  // Anything unrecognised is a bug, not a message: keep the detail in the
  // server log where it's useful and give the user something plain.
  console.error("[action]", error);
  return { ok: false, error: GENERIC };
}
