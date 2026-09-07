import "server-only";
import { auth } from "@/auth";
import { getTenantId } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { roleHasPermission, ROLE_HOME, type Permission } from "@/lib/rbac/permissions";
import { loadActor, sessionRejectionReason } from "@/lib/rbac/actor";
import { ForbiddenError, UnauthorizedError } from "@/lib/rbac/errors";
import type { Role } from "@/generated/prisma/client";

export { ForbiddenError, UnauthorizedError };

/**
 * The layer that actually enforces security (middleware/UI are UX only).
 * Every server action and data-access function that mutates or reads
 * sensitive data must call one of these before touching the database.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();

  const tenantId = await getTenantId();
  if (session.user.tenantId !== tenantId) {
    // Stale session from a different tenant's subdomain — never trust it.
    throw new UnauthorizedError("Session does not match this institute.");
  }

  // The JWT's role and status are a snapshot from sign-in time. Re-read them
  // so deactivating or demoting someone takes effect on their next request
  // rather than whenever their token happens to expire.
  const actor = await loadActor(tenantId, session.user.id);
  const rejection = sessionRejectionReason(actor);
  if (rejection) throw new UnauthorizedError(rejection);

  return { ...session, user: { ...session.user, role: actor!.role } };
}

/**
 * The page/layout form of requireSession. A page never catches, so a guard
 * failure there would surface as a crash screen; these two cases aren't
 * crashes — an expired or revoked session belongs at the login page, and a
 * role that can't see this section belongs at its own home. Anything else
 * still throws, because anything else really is a bug.
 */
export async function requirePageSession() {
  try {
    return await requireSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }
}

export async function requireRole(...roles: Role[]) {
  const session = await requirePageSession();
  if (!roles.includes(session.user.role)) {
    redirect(ROLE_HOME[session.user.role]);
  }
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!roleHasPermission(session.user.role, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return session;
}
