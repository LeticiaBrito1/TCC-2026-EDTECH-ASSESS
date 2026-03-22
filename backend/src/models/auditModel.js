import { randomUUID } from "node:crypto";
import { query } from "../config/database.js";

export const createAuditLog = async ({
  userId = null,
  action,
  entityType = null,
  entityId = null,
  details = {},
}) => {
  await query(
    `
      INSERT INTO app_audit_logs (id, user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [randomUUID(), userId, action, entityType, entityId, JSON.stringify(details || {})]
  );
};

export const listAuditLogs = async ({ limit = 100 } = {}) => {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Number(limit))) : 100;
  const { rows } = await query(
    `
      SELECT id, user_id, action, entity_type, entity_id, details, created_at
      FROM app_audit_logs
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    details: row.details || {},
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  }));
};
