import { ROLE_VALUES } from "@/lib/constants/roles";
import type { Role } from "@/generated/prisma/client";

/**
 * Route groups gated by middleware (UX layer) — see middleware.ts.
 * SUPER_ADMIN can reach every group; every other role is confined to its own.
 *
 * Built from ROLE_VALUES (plain strings), not the generated Prisma `Role`
 * enum object — this file is imported by middleware.ts, which runs in the
 * Edge Runtime and can't load the Prisma client's Node-dependent runtime.
 * `Role` is only used here as a type (erased at compile time).
 */
export const ROUTE_GROUP_ROLES = {
  admin: [ROLE_VALUES.SUPER_ADMIN],
  finance: [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.FINANCE],
  crm: [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.COUNSELOR],
  admissions: [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.ADMISSION_OFFICER],
  teacher: [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.TEACHER],
  portal: [ROLE_VALUES.STUDENT, ROLE_VALUES.PARENT],
} as const satisfies Record<string, Role[]>;

export type RouteGroup = keyof typeof ROUTE_GROUP_ROLES;

/** Default landing route per role, used right after login and for mismatched-route redirects. */
export const ROLE_HOME: Record<Role, string> = {
  [ROLE_VALUES.SUPER_ADMIN]: "/admin/dashboard",
  [ROLE_VALUES.FINANCE]: "/finance/dashboard",
  [ROLE_VALUES.COUNSELOR]: "/crm/leads",
  [ROLE_VALUES.ADMISSION_OFFICER]: "/admissions/pending-kyc",
  [ROLE_VALUES.TEACHER]: "/teacher/timetable",
  [ROLE_VALUES.STUDENT]: "/portal/dashboard",
  [ROLE_VALUES.PARENT]: "/portal/dashboard",
};

/**
 * Action-level permission matrix — the config table PRD §6.10 asks for
 * instead of scattered `if (role === ...)` checks. Server actions/queries
 * call requirePermission(action) (see lib/rbac/guard.ts); this is the layer
 * that actually enforces security. Adjust this table, not call sites, as
 * the client's team structure evolves.
 */
export const PERMISSIONS = {
  "tenant:manage": [ROLE_VALUES.SUPER_ADMIN],
  "user:manage": [ROLE_VALUES.SUPER_ADMIN],
  "academic:manage": [ROLE_VALUES.SUPER_ADMIN],

  "lead:manage": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.COUNSELOR],
  "lead:convert": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.ADMISSION_OFFICER],

  "kyc:manage": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.ADMISSION_OFFICER],
  "student:manage": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.ADMISSION_OFFICER],

  "fee-structure:manage": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.FINANCE],
  "fee-plan:override": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.FINANCE],
  "payment:create": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.FINANCE],
  "payment:correct": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.FINANCE],

  "timetable:manage": [ROLE_VALUES.SUPER_ADMIN],
  "attendance:mark": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.TEACHER],
  "assignment:manage": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.TEACHER],
  "submission:grade": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.TEACHER],

  "submission:create": [ROLE_VALUES.STUDENT],

  "discount:request": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.FINANCE],
  "discount:decide": [ROLE_VALUES.SUPER_ADMIN],
  "announcement:manage": [ROLE_VALUES.SUPER_ADMIN],
  "note:manage": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.TEACHER],
  "exam:manage": [ROLE_VALUES.SUPER_ADMIN, ROLE_VALUES.TEACHER],

  "portal:view": [ROLE_VALUES.STUDENT, ROLE_VALUES.PARENT],
} as const satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
