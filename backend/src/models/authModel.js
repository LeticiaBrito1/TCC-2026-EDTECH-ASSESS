import { query } from "../config/database.js";

const serializeUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    active: row.active,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
};

export const findUserByEmail = async (email) => {
  const { rows } = await query(
    `
      SELECT id, full_name, email, password_hash, role, active, created_at, updated_at
      FROM app_users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [email]
  );

  return rows[0] || null;
};

export const findUserById = async (id) => {
  const { rows } = await query(
    `
      SELECT id, full_name, email, role, active, created_at, updated_at
      FROM app_users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return serializeUser(rows[0]);
};

export const listActiveUsers = async () => {
  const { rows } = await query(
    `
      SELECT id, full_name, email, role, active, created_at, updated_at
      FROM app_users
      WHERE active = TRUE
      ORDER BY created_at ASC
    `
  );

  return rows.map(serializeUser).filter(Boolean);
};
