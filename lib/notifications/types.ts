import type { NotificationType } from "@/generated/prisma/client";

export type NotificationPayload = {
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  /** When set, the notification is sent at most once per recipient per key. */
  dedupeKey?: string;
};

/**
 * Provider-agnostic notification delivery. In-app (DB-backed) is the only
 * real implementation for V1 — SMS/WhatsApp are cost-per-message and an
 * explicit client decision per PRD §11, so they're stubbed here rather than
 * built. Swapping/adding a channel means implementing this interface and
 * registering it in lib/notifications/index.ts — call sites never change.
 */
export interface NotificationProvider {
  /** Resolves true if the notification was delivered, false if its dedupe key had already been used. */
  send(tenantId: string, recipientUserId: string, type: NotificationType, payload: NotificationPayload): Promise<boolean>;
}
