/**
 * Executado uma vez antes de todos os testes E2E.
 * Verifica se o backend e o frontend estão disponíveis.
 */
import { chromium } from "@playwright/test";
import http from "http";

const BACKEND_URL = process.env.E2E_BACKEND_URL || "http://127.0.0.1:8787";
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5174";

// Usa http nativo do Node para evitar qualquer interferência do Playwright no fetch global
function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

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

  // Obtém token via http nativo (sem interferência do Playwright)
  const email = process.env.E2E_EMAIL || "professor@edtech.local";
  console.log("[e2e] Fazendo dev-login:", email);

  const loginResult = await httpPost(`${BACKEND_URL}/api/auth/dev-login`, { email });
  console.log("[e2e] Status do dev-login:", loginResult.status);

  if (loginResult.status !== 200) {
    throw new Error(
      `[e2e] Falha no dev-login: ${loginResult.status}.\n` +
      `Certifique-se de que o backend foi iniciado com ALLOW_DIRECT_LOGIN=true.\n` +
      `Resposta: ${loginResult.body}`
    );
  }

  const { token } = JSON.parse(loginResult.body);

  // Injeta o token no localStorage via browser para salvar o storageState
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  await page.goto(BASE_URL);
  await page.evaluate((t) => localStorage.setItem("edtech_access_token", t), token);
  await context.storageState({ path: "tests/e2e/.auth-state.json" });

  await browser.close();
  console.log("[e2e] Sessão de teste criada com sucesso.");
}
