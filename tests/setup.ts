import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";
import { testActor } from "./helpers/actor";

// Uploads land in a throwaway directory, never the real ./storage tree.
// Set before any module reads it — STORAGE_ROOT is resolved at import time.
process.env.STORAGE_LOCAL_DIR ??= mkdtempSync(join(tmpdir(), "campusos-storage-"));

/**
 * Only the edges are faked: Next's cache invalidation (no server to revalidate)
 * and the session/tenant lookup (no request context). RBAC itself stays real —
 * requirePermission still consults the actual permission matrix, so a test that
 * exercises an action as the wrong role fails the way production would.
 *
 * The guard mock is self-contained rather than wrapping the real module: the
 * real one pulls in next-auth, which can't resolve outside a Next bundle.
 */
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  getTenantId: async () => testActor.tenantId,
  getCurrentTenant: async () => ({ id: testActor.tenantId, name: "Test Institute", subdomain: "test" }),
}));

vi.mock("@/lib/rbac/guard", async () => {
  const { roleHasPermission } = await import("@/lib/rbac/permissions");
  // The real error classes, so `instanceof` in actionError still matches and
  // a guard failure is reported to tests exactly as it would be to a user.
  const { UnauthorizedError, ForbiddenError } = await import("@/lib/rbac/errors");

  const session = () => ({
    user: {
      id: testActor.id,
      role: testActor.role,
      tenantId: testActor.tenantId,
      name: testActor.name,
      email: testActor.email,
    },
  });

  return {
    UnauthorizedError,
    ForbiddenError,
    requireSession: async () => session(),
    requireRole: async (...roles: string[]) => {
      if (!roles.includes(testActor.role)) throw new ForbiddenError();
      return session();
    },
    requirePermission: async (permission: Parameters<typeof roleHasPermission>[1]) => {
      if (!roleHasPermission(testActor.role as never, permission)) {
        throw new ForbiddenError(`Missing permission: ${permission}`);
      }
      return session();
    },
  };
});
