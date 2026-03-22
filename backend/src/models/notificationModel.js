import { randomUUID } from "node:crypto";
import { query } from "../config/database.js";

const serializeNotification = (row) => ({
  id: row.id,
  user_id: row.user_id,
  type: row.type,
  title: row.title,
  message: row.message,
  payload: row.payload || {},
  read_at: row.read_at instanceof Date ? row.read_at.toISOString() : row.read_at,
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
});

export const createNotification = async ({
  userId,
  type = "info",
  title,
  message,
  payload = {},
}) => {
  const { rows } = await query(
    `
      INSERT INTO app_notifications (id, user_id, type, title, message, payload)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING id, user_id, type, title, message, payload, read_at, created_at
    `,
    [randomUUID(), userId, type, title, message, JSON.stringify(payload)]
  );

  return serializeNotification(rows[0]);
};

export const listNotificationsByUser = async (userId, { limit = 20 } = {}) => {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Number(limit))) : 20;
  const { rows } = await query(
    `
      SELECT id, user_id, type, title, message, payload, read_at, created_at
      FROM app_notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return rows.map(serializeNotification);
};

export const markNotificationAsRead = async (id, userId) => {
  const { rows } = await query(
    `
      UPDATE app_notifications
      SET read_at = COALESCE(read_at, NOW())
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, type, title, message, payload, read_at, created_at
    `,
    [id, userId]
  );

  return rows[0] ? serializeNotification(rows[0]) : null;
};

export const markAllNotificationsAsRead = async (userId) => {
  const { rowCount } = await query(
    `
      UPDATE app_notifications
      SET read_at = COALESCE(read_at, NOW())
      WHERE user_id = $1 AND read_at IS NULL
    `,
    [userId]
  );

  return rowCount;
};
