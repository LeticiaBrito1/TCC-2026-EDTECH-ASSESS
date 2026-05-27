/**
 * Configuração compartilhada para todos os testes do backend.
 *
 * - Força banco em memória (pg-mem) via ALLOW_DB_FALLBACK=true + DATABASE_URL vazia
 * - Libera o endpoint /api/auth/dev-login (ALLOW_DIRECT_LOGIN=true)
 * - Inicializa o banco e faz seed dos usuários padrão
 */
import { initDatabase } from "../src/config/database.js";

// ── Env vars de teste ─────────────────────────────────────────────────────────
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "";
process.env.ALLOW_DB_FALLBACK = "true";
process.env.ALLOW_DIRECT_LOGIN = "true";
process.env.JWT_SECRET = "test-secret-key-de-32-caracteres-ok";
process.env.JWT_EXPIRES_IN = "1h";
process.env.DEV_ADMIN_EMAIL = "admin@edtech.local";
process.env.DEV_ADMIN_PASSWORD = "admin123";
process.env.DEV_PROFESSOR_EMAIL = "professor@edtech.local";
process.env.DEV_PROFESSOR_PASSWORD = "prof123";

// ── Inicializa banco em memória uma vez antes de todos os testes ──────────────
let dbReady = false;

export const ensureDb = async () => {
  if (!dbReady) {
    await initDatabase();
    dbReady = true;
  }
};
