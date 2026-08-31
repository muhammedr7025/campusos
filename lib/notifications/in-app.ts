import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/client";
import type { NotificationPayload, NotificationProvider } from "@/lib/notifications/types";

export class InAppNotificationProvider implements NotificationProvider {
  async send(tenantId: string, recipientUserId: string, type: NotificationType, payload: NotificationPayload) {
    await prisma.notification.create({
      data: {
        tenantId,
        recipientId: recipientUserId,
        type,
        title: payload.title,
        body: payload.body,
        relatedEntityType: payload.relatedEntityType,
        relatedEntityId: payload.relatedEntityId,
      },
    });
  }
}
