/**
 * Testes de integração — endpoints de autenticação
 * Banco: pg-mem (em memória, sem dependências externas)
 */
import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { ensureDb } from "./setup.js";
import { app } from "../src/app.js";

beforeAll(async () => {
  await ensureDb();
});

describe("POST /api/auth/dev-login", () => {
  it("retorna token para professor padrão", async () => {
    const res = await request(app)
      .post("/api/auth/dev-login")
      .send({ email: "professor@edtech.local", password: "prof123" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.role).toBe("professor");
  });

  it("retorna token para admin padrão", async () => {
    const res = await request(app)
      .post("/api/auth/dev-login")
      .send({ email: "admin@edtech.local", password: "admin123" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.role).toBe("admin");
  });

  it("rejeita senha incorreta com 401", async () => {
    const res = await request(app)
      .post("/api/auth/dev-login")
      .send({ email: "professor@edtech.local", password: "senhaerrada" });

    expect(res.status).toBe(401);
  });

  it("rejeita email inexistente com 401", async () => {
    const res = await request(app)
      .post("/api/auth/dev-login")
      .send({ email: "naoexiste@edtech.local", password: "qualquer" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/dev-login")
      .send({ email: "professor@edtech.local", password: "prof123" });
    token = res.body.token;
  });

  it("retorna dados do usuário autenticado", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("professor@edtech.local");
  });

  it("retorna 401 sem token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token inválido", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer token-invalido");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/health", () => {
  it("retorna status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
  });
});
