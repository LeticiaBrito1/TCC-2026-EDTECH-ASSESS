/**
 * Executado uma vez antes de todos os testes E2E.
 * Verifica se o backend e o frontend estão disponíveis.
 */
import { chromium } from "@playwright/test";

const BACKEND_URL = process.env.E2E_BACKEND_URL || "http://localhost:8787";
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5174";

export default async function globalSetup() {
  // Verifica se o backend responde antes de iniciar os testes
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`);
    if (!res.ok) throw new Error(`Backend retornou ${res.status}`);
    console.log("[e2e] Backend disponível em", BACKEND_URL);
  } catch (err) {
    throw new Error(
      `[e2e] Backend não disponível em ${BACKEND_URL}.\n` +
      `Execute "npm run backend:dev" antes de rodar os testes E2E.\n` +
      `Detalhe: ${err.message}`
    );
  }

  // Obtém e salva o estado de autenticação para reusar nos testes
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  // Obtém token diretamente via API (sem 2FA)
  const loginRes = await page.request.post(`${BACKEND_URL}/api/auth/dev-login`, {
    data: {
      email: process.env.E2E_EMAIL || "professor@edtech.local",
      password: process.env.E2E_PASSWORD || "prof123",
    },
  });

  if (!loginRes.ok()) {
    throw new Error(
      `[e2e] Falha no dev-login: ${loginRes.status()}. ` +
      `Certifique-se de que o backend foi iniciado com ALLOW_DIRECT_LOGIN=true.`
    );
  }

  const { token } = await loginRes.json();

  // Injeta o token no localStorage antes de qualquer teste
  await page.goto(BASE_URL);
  await page.evaluate((t) => localStorage.setItem("edtech_access_token", t), token);
  await context.storageState({ path: "tests/e2e/.auth-state.json" });

  await browser.close();
  console.log("[e2e] Sessão de teste criada com sucesso.");
}
