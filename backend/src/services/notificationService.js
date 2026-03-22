import { env } from "../config/env.js";
import {
  createNotification,
  listNotificationsByUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../models/notificationModel.js";

const safePostWebhook = async (event) => {
  if (!env.notificationsWebhookUrl) return;

  try {
    await fetch(env.notificationsWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch {
    // Notificação externa não deve quebrar o fluxo principal.
  }
};

export const notificationService = {
  async createForUser(input) {
    const created = await createNotification(input);
    await safePostWebhook({
      event: "notification.created",
      user_id: created.user_id,
      type: created.type,
      title: created.title,
      message: created.message,
    });
    return created;
  },

  async createForUsers(userIds, input) {
    const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
    const created = [];

    for (const userId of uniqueIds) {
      const item = await this.createForUser({
        ...input,
        userId,
      });
      created.push(item);
    }

    return created;
  },

  async listByUser(userId, options) {
    return listNotificationsByUser(userId, options);
  },

  async markAsRead(id, userId) {
    return markNotificationAsRead(id, userId);
  },

  async markAllAsRead(userId) {
    return markAllNotificationsAsRead(userId);
  },
};
