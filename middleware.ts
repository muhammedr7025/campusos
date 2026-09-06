import { NextResponse } from "next/server";
import { auth } from "@/auth-edge";
import { ROUTE_GROUP_ROLES, ROLE_HOME, type RouteGroup } from "@/lib/rbac/permissions";
import { ROLE_VALUES, type RoleValue } from "@/lib/constants/roles";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const TENANT_COOKIE = "tenant";

const PUBLIC_PATHS = ["/", "/login"];

const ROUTE_GROUP_PREFIXES: [prefix: string, group: RouteGroup][] = [
  ["/admin", "admin"],
  ["/finance", "finance"],
  ["/crm", "crm"],
  ["/admissions", "admissions"],
  ["/teacher", "teacher"],
  ["/portal", "portal"],
];

/**
 * A handful of pages live under one section's URL prefix but are legitimately
 * linked to from another role's own nav too (e.g. Finance's "Audit log" entry
 * points at /admin/audit). The target page's own requireRole call is what
 * actually enforces access — this list only widens the edge-layer redirect
 * gate above so following that link doesn't bounce the visitor back home.
 */
const EXTRA_ALLOWED_ROLES: [prefix: string, roles: RoleValue[]][] = [
  ["/admin/audit", [ROLE_VALUES.FINANCE]],
];

/**
 * Resolves which tenant a request belongs to and forwards it downstream as
 * the `x-tenant-slug` header — this is the ONLY place tenant resolution
 * happens. Everything after this trusts the header, never the host again.
 *
 * Resolution order:
 *  1. Subdomain of the request host (`acme.localhost:3000` -> "acme").
 *     Modern browsers resolve *.localhost to loopback, so this works in dev
 *     exactly like real subdomains would in prod (`acme.yourdomain.com`).
 *  2. `?tenant=slug` query param (dev/tooling convenience when subdomains
 *     aren't practical, e.g. curl against bare localhost).
 *  3. `tenant` cookie, set the first time (2) is used, so it survives
 *     subsequent navigations without repeating the query param.
 */
function resolveSubdomain(host: string): string | null {
  const hostname = host.split(":")[0];
  const rootHostname = ROOT_DOMAIN.split(":")[0];
  if (hostname === rootHostname) return null;
  if (hostname.endsWith(`.${rootHostname}`)) {
    return hostname.slice(0, -(rootHostname.length + 1));
  }
  // Custom domain (production white-label): resolved by full hostname
  // instead of a slug — handled by getCurrentTenant's customDomain lookup.
  return null;
}

export default auth((req) => {
  const host = req.headers.get("host") ?? ROOT_DOMAIN;
  const url = req.nextUrl;
  const pathname = url.pathname;

  const subdomainSlug = resolveSubdomain(host);
  const queryTenant = url.searchParams.get("tenant");
  const cookieTenant = req.cookies.get(TENANT_COOKIE)?.value;
  const slug = subdomainSlug ?? queryTenant ?? cookieTenant ?? null;

  const requestHeaders = new Headers(req.headers);
  if (slug) requestHeaders.set("x-tenant-slug", slug);
  requestHeaders.set("x-tenant-host", host);

  // Route-group gating (layer 1 of 3 — UX only; server actions/queries in
  // lib/rbac/guard.ts are the layer that actually enforces this).
  if (!PUBLIC_PATHS.includes(pathname) && !pathname.startsWith("/api/auth")) {
    const matchedGroup = ROUTE_GROUP_PREFIXES.find(([prefix]) => pathname.startsWith(prefix));
    if (matchedGroup) {
      const [, group] = matchedGroup;
      const role = req.auth?.user?.role;
      if (!role) {
        const loginUrl = new URL("/login", url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }
      const extraAllowed = EXTRA_ALLOWED_ROLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? [];
      const allowed = (ROUTE_GROUP_ROLES[group] as readonly RoleValue[]).includes(role) || extraAllowed.includes(role);
      if (!allowed) {
        return NextResponse.redirect(new URL(ROLE_HOME[role], url));
      }
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (queryTenant && queryTenant !== cookieTenant) {
    response.cookies.set(TENANT_COOKIE, queryTenant, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });
  }

  return response;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
