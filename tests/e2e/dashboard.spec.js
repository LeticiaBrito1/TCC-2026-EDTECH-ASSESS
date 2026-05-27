/**
 * Testes E2E — Dashboard
 */
import { test, expect } from "@playwright/test";
import { AUTH_STATE_PATH } from "./helpers/auth.js";

// Reutiliza a sessão criada no global-setup
test.use({ storageState: AUTH_STATE_PATH });

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Aguarda o dashboard carregar (h1 "Painel")
    await page.waitForSelector("h1", { timeout: 10000 });
  });

  test("exibe o título Painel", async ({ page }) => {
    await expect(page.locator("h1").first()).toContainText("Painel");
  });

  test("exibe os 4 cards de estatísticas", async ({ page }) => {
    // Os cards de Turmas, Alunos, Questões e Avaliações
    await expect(page.getByText("Turmas")).toBeVisible();
    await expect(page.getByText("Alunos")).toBeVisible();
    await expect(page.getByText("Questões")).toBeVisible();
    await expect(page.getByText("Avaliações")).toBeVisible();
  });

  test("navega para /Turmas ao clicar no card Turmas", async ({ page }) => {
    // Clica no card que contém "Turmas" (dentro da navegação rápida)
    await page.locator('[role="button"]').filter({ hasText: "Turmas" }).first().click();
    await expect(page).toHaveURL(/Turmas/);
  });

  test("navega para /Alunos ao clicar no card Alunos", async ({ page }) => {
    await page.locator('[role="button"]').filter({ hasText: "Alunos" }).first().click();
    await expect(page).toHaveURL(/Alunos/);
  });
});
