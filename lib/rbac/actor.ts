import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";

export type Actor = { id: string; role: Role; isActive: boolean };

/**
 * The signed-in user as the database sees them *now*.
 *
 * The session is a JWT: role and tenant are stamped into it at sign-in and
 * stay frozen until it expires. Without this lookup, deactivating a user or
 * changing their role has no effect on anyone already signed in — the
 * "Active" switch in Admin → Users would be decorative, and a demoted
 * account would keep its old permissions for the life of its token.
 *
 * Cached per request, so the guards can call it as often as they like.
 */
export const loadActor = cache(async (tenantId: string, userId: string): Promise<Actor | null> => {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { id: true, role: true, isActive: true },
  });
  return user ?? null;
});

/** Why a session is no longer usable, or null if it still is. */
export function sessionRejectionReason(actor: Actor | null): string | null {
  if (!actor) return "This account no longer exists.";
  if (!actor.isActive) return "This account has been deactivated.";
  return null;
}
