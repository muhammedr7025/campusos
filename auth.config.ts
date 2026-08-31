import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/client";

/**
 * Edge-safe base config — no Credentials provider here (its authorize()
 * needs Prisma + bcrypt, which can't run in the Edge Runtime). middleware.ts
 * uses this directly (via auth-edge.ts) just to decode the session JWT for
 * route gating; auth.ts extends this with the real provider for everywhere
 * else (route handlers, server actions, server components).
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.tenantId = token.tenantId as string;
      return session;
    },
    // Auth.js's default redirect callback only allows URLs matching a single
    // baseUrl, which breaks this app's per-tenant-subdomain model (each
    // tenant's callbackUrl is a different origin). Allow any URL whose host
    // is the root domain or a subdomain of it; fall back to baseUrl for
    // anything else (open-redirect protection).
    async redirect({ url, baseUrl }) {
      const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").split(":")[0];
      try {
        const target = new URL(url, baseUrl);
        if (target.hostname === rootDomain || target.hostname.endsWith(`.${rootDomain}`)) {
          return target.toString();
        }
      } catch {
        // fall through
      }
      return url.startsWith("/") ? `${baseUrl}${url}` : baseUrl;
    },
  },
} satisfies NextAuthConfig;
