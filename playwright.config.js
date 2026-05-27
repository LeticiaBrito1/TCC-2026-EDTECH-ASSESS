import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração dos testes E2E com Playwright.
 *
 * Como executar:
 *   1. Inicie o backend:  npm run backend:dev
 *   2. Inicie o frontend: npm run dev
 *   3. Rode os testes:    npm run test:e2e
 *
 * Ou tudo junto: npm run test:e2e:start
 */

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5174";
const BACKEND_URL = process.env.E2E_BACKEND_URL || "http://localhost:8787";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // testes sequenciais para evitar conflitos de estado
  reporter: [["list"], ["html", { open: "never", outputFolder: "tests/e2e/report" }]],

  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Passa a URL do backend para os helpers de autenticação
    extraHTTPHeaders: {},
  },

  // Variáveis de ambiente disponíveis nos testes
  globalSetup: "./tests/e2e/global-setup.js",

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

export { BASE_URL, BACKEND_URL };
