import "server-only";
import { auth } from "@/auth";
import { getTenantId } from "@/lib/tenant";
import { roleHasPermission, type Permission } from "@/lib/rbac/permissions";
import type { Role } from "@/generated/prisma/client";

export class UnauthorizedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do this") {
    super(message);
    this.name = "ForbiddenError";
  }
}

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

  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    throw new ForbiddenError();
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
