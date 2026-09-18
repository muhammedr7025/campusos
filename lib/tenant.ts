import { headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Tenant } from "@/generated/prisma/client";

/**
 * Tenant resolution: the proxy (see proxy.ts) parses the request host
 * into a subdomain and forwards it as the `x-tenant-slug` header. This is
 * the single place server code reads it back. No cross-tenant query should
 * be *possible* to write — every data-access function must call
 * getTenantId() rather than accept a tenantId parameter from the caller.
 */
export const getTenantSlug = cache(async (): Promise<string | null> => {
  const h = await headers();
  return h.get("x-tenant-slug");
});

/** The bare hostname of the request, for white-label custom domains. */
export const getTenantHost = cache(async (): Promise<string | null> => {
  const h = await headers();
  const host = h.get("x-tenant-host") ?? h.get("host");
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
});

export const getCurrentTenant = cache(async (): Promise<Tenant | null> => {
  const slug = await getTenantSlug();
  if (slug) return prisma.tenant.findUnique({ where: { subdomain: slug } });

  // No subdomain under the root domain: an institute on its own domain
  // (`portal.acme-institute.edu`), matched by the whole hostname.
  const host = await getTenantHost();
  if (!host) return null;
  return prisma.tenant.findFirst({ where: { customDomain: host } });
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
