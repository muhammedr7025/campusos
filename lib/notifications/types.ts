import type { NotificationType } from "@/generated/prisma/client";

export type NotificationPayload = {
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

/**
 * Provider-agnostic notification delivery. In-app (DB-backed) is the only
 * real implementation for V1 — SMS/WhatsApp are cost-per-message and an
 * explicit client decision per PRD §11, so they're stubbed here rather than
 * built. Swapping/adding a channel means implementing this interface and
 * registering it in lib/notifications/index.ts — call sites never change.
 */
export interface NotificationProvider {
  send(tenantId: string, recipientUserId: string, type: NotificationType, payload: NotificationPayload): Promise<void>;
}
