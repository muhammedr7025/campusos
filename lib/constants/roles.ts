/**
 * Client-safe mirror of the Prisma `Role` enum values. Client Components
 * must never import the generated Prisma client at runtime (only as
 * `import type`) — its ESM output pulls in Node built-ins (`node:module`)
 * that Turbopack can't bundle for the browser. This gives client code the
 * same string values without touching `@/generated/prisma/client`.
 */
export const ROLE_VALUES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  FINANCE: "FINANCE",
  COUNSELOR: "COUNSELOR",
  ADMISSION_OFFICER: "ADMISSION_OFFICER",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
  PARENT: "PARENT",
} as const;

export type RoleValue = (typeof ROLE_VALUES)[keyof typeof ROLE_VALUES];
