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
  },
} satisfies NextAuthConfig;
