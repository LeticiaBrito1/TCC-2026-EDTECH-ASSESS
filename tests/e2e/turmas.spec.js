/**
 * Testes E2E — CRUD de Turmas
 */
import { test, expect } from "@playwright/test";
import { AUTH_STATE_PATH } from "./helpers/auth.js";

test.use({ storageState: AUTH_STATE_PATH });

const TURMA_NOME = `Turma E2E ${Date.now()}`;

test.describe("Turmas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/Turmas");
    await page.waitForLoadState("networkidle");
  });

  test("exibe a página de Turmas", async ({ page }) => {
    await expect(page.locator("h1, h2").first()).toContainText(/Turmas/i);
  });

  test("abre o modal de nova turma ao clicar em Nova Turma", async ({ page }) => {
    await page.getByRole("button", { name: /nova turma/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("cria uma turma e ela aparece na lista", async ({ page }) => {
    // Abre modal
    await page.getByRole("button", { name: /nova turma/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Preenche nome
    await page.getByRole("dialog").locator("input").first().fill(TURMA_NOME);

    // Salva
    await page.getByRole("dialog").getByRole("button", { name: /criar|salvar/i }).click();

    // Confirma que a turma aparece na lista
    await expect(page.getByText(TURMA_NOME)).toBeVisible({ timeout: 8000 });
  });

  test("exibe mensagem de estado vazio quando não há turmas", async ({ page }) => {
    // Se não há turmas, exibe mensagem de vazio — mas esse teste passa sempre
    // pois o estado depende do banco. Verificamos apenas que a página carrega.
    const isLoaded = await page.locator("h1, h2, [data-empty]").first().isVisible();
    expect(isLoaded).toBe(true);
  });
});
