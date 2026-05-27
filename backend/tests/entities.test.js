/**
 * Testes de integração — CRUD de entidades (turmas, alunos, questões, avaliações)
 * Banco: pg-mem (em memória)
 *
 * As entidades usam a rota genérica:  /api/entities/:entity
 */
import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { ensureDb } from "./setup.js";
import { app } from "../src/app.js";

let token;

beforeAll(async () => {
  await ensureDb();
  const res = await request(app)
    .post("/api/auth/dev-login")
    .send({ email: "professor@edtech.local", password: "prof123" });
  token = res.body.token;
});

const auth = () => ({ Authorization: `Bearer ${token}` });

// ── helpers de rota ───────────────────────────────────────────────────────────
const api = (entity) => `/api/entities/${entity}`;

// ── TURMAS ────────────────────────────────────────────────────────────────────
describe("Turmas", () => {
  let turmaId;

  it("lista turmas", async () => {
    const res = await request(app).get(api("turmas")).set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("cria uma turma", async () => {
    const res = await request(app)
      .post(api("turmas"))
      .set(auth())
      .send({ nome: "Turma A", nivel: "medio", ano: 2024 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.nome).toBe("Turma A");
    turmaId = res.body.id;
  });

  it("busca turma por ID", async () => {
    const res = await request(app).get(`${api("turmas")}/${turmaId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(turmaId);
  });

  it("atualiza uma turma", async () => {
    const res = await request(app)
      .put(`${api("turmas")}/${turmaId}`)
      .set(auth())
      .send({ nome: "Turma A — Atualizada", nivel: "medio" });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe("Turma A — Atualizada");
  });

  it("exclui uma turma", async () => {
    const res = await request(app).delete(`${api("turmas")}/${turmaId}`).set(auth());
    expect([200, 204]).toContain(res.status);
  });

  it("retorna 404 ao buscar turma excluída", async () => {
    const res = await request(app).get(`${api("turmas")}/${turmaId}`).set(auth());
    expect(res.status).toBe(404);
  });
});

// ── ALUNOS ────────────────────────────────────────────────────────────────────
describe("Alunos", () => {
  let turmaId;
  let alunoId;

  beforeAll(async () => {
    const res = await request(app)
      .post(api("turmas"))
      .set(auth())
      .send({ nome: "Turma Teste Alunos", nivel: "fundamental" });
    turmaId = res.body.id;
  });

  it("cria um aluno", async () => {
    const res = await request(app)
      .post(api("alunos"))
      .set(auth())
      .send({ nome: "Maria Silva", matricula: "001", turma_id: turmaId });

    expect(res.status).toBe(201);
    expect(res.body.nome).toBe("Maria Silva");
    alunoId = res.body.id;
  });

  it("lista alunos", async () => {
    const res = await request(app).get(api("alunos")).set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("requer autenticação para listar alunos", async () => {
    const res = await request(app).get(api("alunos"));
    expect(res.status).toBe(401);
  });
});

// ── QUESTÕES ──────────────────────────────────────────────────────────────────
describe("Questões", () => {
  let questaoId;

  it("cria uma questão", async () => {
    const res = await request(app)
      .post(api("questoes"))
      .set(auth())
      .send({
        enunciado: "Quanto é 2 + 2?",
        gabarito: "A",
        nivel_dificuldade: "facil",
        alternativas: [
          { letra: "A", texto: "4" },
          { letra: "B", texto: "3" },
          { letra: "C", texto: "5" },
          { letra: "D", texto: "6" },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.enunciado).toBe("Quanto é 2 + 2?");
    questaoId = res.body.id;
  });

  it("lista questões", async () => {
    const res = await request(app).get(api("questoes")).set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("busca questão por ID", async () => {
    const res = await request(app).get(`${api("questoes")}/${questaoId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(questaoId);
  });

  it("requer autenticação", async () => {
    const res = await request(app).get(api("questoes"));
    expect(res.status).toBe(401);
  });
});

// ── AVALIAÇÕES ────────────────────────────────────────────────────────────────
describe("Avaliações", () => {
  let avaliacaoId;

  it("cria uma avaliação", async () => {
    const res = await request(app)
      .post(api("avaliacoes"))
      .set(auth())
      .send({ titulo: "Prova 1 — Matemática", status: "rascunho", total_pontos: 10 });

    expect(res.status).toBe(201);
    expect(res.body.titulo).toBe("Prova 1 — Matemática");
    avaliacaoId = res.body.id;
  });

  it("atualiza status da avaliação", async () => {
    const res = await request(app)
      .put(`${api("avaliacoes")}/${avaliacaoId}`)
      .set(auth())
      .send({ titulo: "Prova 1 — Matemática", status: "publicada", total_pontos: 10 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("publicada");
  });

  it("lista avaliações", async () => {
    const res = await request(app).get(api("avaliacoes")).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.some((a) => a.id === avaliacaoId)).toBe(true);
  });

  it("exclui uma avaliação", async () => {
    const res = await request(app)
      .delete(`${api("avaliacoes")}/${avaliacaoId}`)
      .set(auth());
    expect([200, 204]).toContain(res.status);
  });
});
