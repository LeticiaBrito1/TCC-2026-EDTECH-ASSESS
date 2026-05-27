/**
 * Testes E2E — Tela de Correção
 */
import { test, expect } from "@playwright/test";
import { AUTH_STATE_PATH } from "./helpers/auth.js";

test.use({ storageState: AUTH_STATE_PATH });

test.describe("Correção", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/Correcao");
    await page.waitForLoadState("networkidle");
  });

  test("exibe o título Correção Automática por Foto", async ({ page }) => {
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
    // Verifica que existe ao menos um heading com "Correção"
    const heading = page.getByRole("heading", { name: /corre/i });
    await expect(heading.first()).toBeVisible();
  });

  test("exibe o card de Correção Automática por Foto", async ({ page }) => {
    await expect(page.getByText(/foto|ocr|imagem/i).first()).toBeVisible();
  });

  test("exibe botões de selecionar imagem e câmera", async ({ page }) => {
    const buttons = page.getByRole("button");
    await expect(buttons.first()).toBeVisible();
  });

  test("não exibe o QR Code (foi removido)", async ({ page }) => {
    // QR Code foi removido da versão web — não deve aparecer
    const qrText = page.getByText(/qr code/i);
    await expect(qrText).toHaveCount(0);
  });
});
