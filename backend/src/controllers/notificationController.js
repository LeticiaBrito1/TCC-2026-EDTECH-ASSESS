import { notificationService } from "../services/notificationService.js";
import { HttpError } from "../utils/httpError.js";

export const notificationController = {
  async list(req, res) {
    const limit = Number(req.query.limit || 20);
    const notifications = await notificationService.listByUser(req.user.id, { limit });
    const unread = notifications.filter((item) => !item.read_at).length;
    res.json({ items: notifications, unread });
  },

  async markAsRead(req, res) {
    const updated = await notificationService.markAsRead(req.params.id, req.user.id);
    if (!updated) {
      throw new HttpError(404, "Notificação não encontrada.");
    }
    res.json(updated);
  },

  async markAllAsRead(req, res) {
    const count = await notificationService.markAllAsRead(req.user.id);
    res.json({ updated: count });
  },
};
