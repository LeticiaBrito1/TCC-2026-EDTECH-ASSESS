import { test, expect } from "@playwright/test";

test.describe("Tela de Login", () => {
  test("carrega a página de login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/EdTech/i);
  });

  test("exibe campo de e-mail e senha", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
  });

  test("exibe botão Entrar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });

  test("exibe link para criar conta", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/criar conta/i)).toBeVisible();
  });

  test("exibe link esqueci a senha", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/esqueci/i)).toBeVisible();
  });
});

test.describe("Acessibilidade", () => {
  test("widget de acessibilidade está visível", async ({ page }) => {
    await page.goto("/");
    const gear = page.getByRole("button", { name: /acessibilidade/i });
    await expect(gear).toBeVisible();
  });

  test("abre painel de acessibilidade ao clicar na engrenagem", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /abrir configurações de acessibilidade/i }).click();
    await expect(page.getByText(/alto contraste/i)).toBeVisible();
    await expect(page.getByText(/texto grande/i)).toBeVisible();
  });
});

test.describe("Segurança", () => {
  test("bloqueia login com credenciais inválidas", async ({ page }) => {
    await page.goto("/");
    await page.locator("input[type='email']").fill("invalido@teste.com");
    await page.locator("input[type='password']").fill("senhaerrada");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByText(/inválid|incorret|erro|código/i)).toBeVisible({ timeout: 15000 });
  });
});
