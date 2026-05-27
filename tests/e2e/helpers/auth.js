/**
 * Helper de autenticação para testes E2E.
 *
 * Uso nos specs:
 *   import { useAuth } from "../helpers/auth.js";
 *
 *   test.use({ storageState: AUTH_STATE_PATH });
 *   // ou manualmente:
 *   await injectToken(page);
 */
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AUTH_STATE_PATH = path.join(__dirname, "../.auth-state.json");

const BACKEND_URL = process.env.E2E_BACKEND_URL || "http://localhost:8787";

/**
 * Obtém um JWT diretamente do backend (sem 2FA) e injeta no localStorage.
 * Use quando precisar de um contexto de página autenticada sem o storageState.
 */
export async function injectToken(page, credentials = {}) {
  const email = credentials.email || process.env.E2E_EMAIL || "professor@edtech.local";
  const password = credentials.password || process.env.E2E_PASSWORD || "prof123";

  const res = await page.request.post(`${BACKEND_URL}/api/auth/dev-login`, {
    data: { email, password },
  });

  if (!res.ok()) {
    throw new Error(`dev-login falhou: ${res.status()}`);
  }

  const { token } = await res.json();
  await page.evaluate((t) => localStorage.setItem("edtech_access_token", t), token);
  return token;
}
