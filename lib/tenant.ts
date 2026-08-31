import { headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Tenant } from "@/generated/prisma/client";

/**
 * Tenant resolution: middleware (see middleware.ts) parses the request host
 * into a subdomain and forwards it as the `x-tenant-slug` header. This is
 * the single place server code reads it back. No cross-tenant query should
 * be *possible* to write — every data-access function must call
 * getTenantId() rather than accept a tenantId parameter from the caller.
 */
export const getTenantSlug = cache(async (): Promise<string | null> => {
  const h = await headers();
  return h.get("x-tenant-slug");
});

export const getCurrentTenant = cache(async (): Promise<Tenant | null> => {
  const slug = await getTenantSlug();
  if (!slug) return null;
  return prisma.tenant.findUnique({ where: { subdomain: slug } });
});

export async function getTenantId(): Promise<string> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    throw new Error(
      "No tenant resolved for this request. Every server action/query must run behind tenant-resolution middleware.",
    );
  }
  return tenant.id;
}
