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

export const createUser = async ({ id, full_name, email, password_hash, role, phone, verification_token, verification_expires }) => {
  const { rows } = await query(
    `
      INSERT INTO app_users
        (id, full_name, email, password_hash, role, active, token_version, email_verified, phone, verification_token, verification_expires)
      VALUES ($1, $2, lower($3), $4, $5, TRUE, 0, FALSE, $6, $7, $8)
      RETURNING id, full_name, email, role, active, email_verified, phone, created_at, updated_at
    `,
    [id, full_name, email, password_hash, role, phone || null, verification_token, verification_expires]
  );
  return serializeUser(rows[0]);
};

export const findUserByPhone = async (phone) => {
  const { rows } = await query(
    `SELECT id, full_name, email, password_hash, role, active, email_verified, phone, token_version,
            login_code, login_code_expires, reset_token, reset_token_expires, created_at, updated_at
     FROM app_users WHERE phone = $1 LIMIT 1`,
    [phone]
  );
  return rows[0] || null;
};

export const findUserByVerificationToken = async (token) => {
  const { rows } = await query(
    `SELECT id, full_name, email, role, active, email_verified, verification_token, verification_expires
     FROM app_users WHERE verification_token = $1 LIMIT 1`,
    [token]
  );
  return rows[0] || null;
};

export const markEmailVerified = async (id) => {
  await query(
    `UPDATE app_users
     SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL, updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
};

export const setVerificationToken = async (id, token, expires) => {
  await query(
    `UPDATE app_users SET verification_token = $1, verification_expires = $2, updated_at = NOW() WHERE id = $3`,
    [token, expires, id]
  );
};

export const findUserByEmail = async (email) => {
  const { rows } = await query(
    `
      SELECT id, full_name, email, password_hash, role, active, email_verified, phone, token_version,
             login_code, login_code_expires, reset_token, reset_token_expires, created_at, updated_at
      FROM app_users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [email]
  );

  return rows[0] || null;
};

export const setLoginCode = async (id, code, expires) => {
  await query(
    `UPDATE app_users SET login_code = $1, login_code_expires = $2, updated_at = NOW() WHERE id = $3`,
    [code, expires, id]
  );
};

export const clearLoginCode = async (id) => {
  await query(
    `UPDATE app_users SET login_code = NULL, login_code_expires = NULL, updated_at = NOW() WHERE id = $1`,
    [id]
  );
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

export const updateUser = async (id, { full_name, email }) => {
  const { rows } = await query(
    `UPDATE app_users SET full_name = $1, email = $2, updated_at = NOW() WHERE id = $3 RETURNING id, full_name, email, role, active, created_at, updated_at`,
    [full_name, email, id]
  );
  return serializeUser(rows[0]);
};

export const updateUserPassword = async (id, passwordHash) => {
  await query(
    `UPDATE app_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [passwordHash, id]
  );
};

export const findUserByIdWithHash = async (id) => {
  const { rows } = await query(
    `SELECT id, full_name, email, password_hash, role, active, token_version FROM app_users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

export const findUserByIdWithVersion = async (id) => {
  const { rows } = await query(
    `SELECT id, role, active, token_version FROM app_users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

export const incrementTokenVersion = async (id) => {
  await query(
    `UPDATE app_users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1`,
    [id]
  );
};

export const setResetToken = async (id, token, expires) => {
  await query(
    `UPDATE app_users SET reset_token = $1, reset_token_expires = $2, updated_at = NOW() WHERE id = $3`,
    [token, expires, id]
  );
};

export const findUserByResetToken = async (token) => {
  const { rows } = await query(
    `SELECT id, full_name, email, role, active, reset_token, reset_token_expires
     FROM app_users WHERE reset_token = $1 LIMIT 1`,
    [token]
  );
  return rows[0] || null;
};

export const clearResetToken = async (id) => {
  await query(
    `UPDATE app_users SET reset_token = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $1`,
    [id]
  );
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
