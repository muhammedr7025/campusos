import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe session reader for middleware.ts only — no Credentials
// provider, so no Prisma/bcrypt in the bundle. Everywhere else in the app
// imports { auth } from "@/auth" instead.
export const { auth } = NextAuth(authConfig);
