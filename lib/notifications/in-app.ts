import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/client";
import type { NotificationPayload, NotificationProvider } from "@/lib/notifications/types";

export class InAppNotificationProvider implements NotificationProvider {
  async send(tenantId: string, recipientUserId: string, type: NotificationType, payload: NotificationPayload) {
    // skipDuplicates turns a repeated dedupe key into a no-op at the database,
    // so concurrent reminder runs can't both deliver the same one.
    const { count } = await prisma.notification.createMany({
      data: [
        {
          tenantId,
          recipientId: recipientUserId,
          type,
          title: payload.title,
          body: payload.body,
          relatedEntityType: payload.relatedEntityType,
          relatedEntityId: payload.relatedEntityId,
          dedupeKey: payload.dedupeKey ?? null,
        },
      ],
      skipDuplicates: true,
    });
    return count > 0;
  }
}
