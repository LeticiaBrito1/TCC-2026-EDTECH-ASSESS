/**
 * Testes E2E — Fluxo de autenticação (tela de login)
 * Estes testes NÃO usam storageState — testam a tela de login em si.
 */
import { test, expect } from "@playwright/test";

test.describe("Tela de Login", () => {
  test.beforeEach(async ({ page }) => {
    // Garante que não há sessão ativa
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("edtech_access_token"));
    await page.reload();
    await page.waitForLoadState("networkidle");
  });

  test("exibe o formulário de login", async ({ page }) => {
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });

  test("exibe erro com credenciais inválidas", async ({ page }) => {
    await page.fill("#login-email", "usuario@naoexiste.com");
    await page.fill("#login-password", "senhaerrada123");
    await page.getByRole("button", { name: /entrar/i }).click();

    // Aguarda mensagem de erro aparecer (role="alert" ou texto de erro)
    await expect(
      page.locator('[role="alert"]').or(page.getByText(/inválid|incorret|erro/i))
    ).toBeVisible({ timeout: 8000 });
  });

  test("exibe link para criar conta", async ({ page }) => {
    await expect(page.getByRole("button", { name: /criar conta/i })).toBeVisible();
  });

  test("exibe link para esqueci a senha", async ({ page }) => {
    await expect(page.getByRole("button", { name: /esqueci/i })).toBeVisible();
  });

  test("navega para tela de cadastro", async ({ page }) => {
    await page.getByRole("button", { name: /criar conta/i }).click();
    await expect(page.locator("#reg-name")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Tela de Cadastro", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("edtech_access_token"));
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /criar conta/i }).click();
    await page.waitForSelector("#reg-name");
  });

  test("exibe os campos do formulário de cadastro", async ({ page }) => {
    await expect(page.locator("#reg-name")).toBeVisible();
    await expect(page.locator("#reg-email")).toBeVisible();
    await expect(page.locator("#reg-password")).toBeVisible();
    await expect(page.locator("#reg-confirm")).toBeVisible();
  });

  test("abre o modal de Termos de Uso", async ({ page }) => {
    await page.getByRole("button", { name: /termos de uso/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(/termos/i);
  });

  test("abre o modal de Política de Privacidade", async ({ page }) => {
    await page.getByRole("button", { name: /política de privacidade/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
