import { InAppNotificationProvider } from "@/lib/notifications/in-app";
import type { NotificationProvider } from "@/lib/notifications/types";

// SMS/WhatsApp: implement NotificationProvider and add alongside in-app
// once the client confirms per-message budget (PRD §11/§12).
export const notifier: NotificationProvider = new InAppNotificationProvider();

export type { NotificationProvider, NotificationPayload } from "@/lib/notifications/types";
