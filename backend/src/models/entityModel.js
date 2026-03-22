import { randomUUID } from "node:crypto";
import { query } from "../config/database.js";

const ENTITY_ALIASES = {
  turma: "turmas",
  turmas: "turmas",
  disciplina: "disciplinas",
  disciplinas: "disciplinas",
  aluno: "alunos",
  alunos: "alunos",
  questao: "questoes",
  questoes: "questoes",
  questão: "questoes",
  questões: "questoes",
  avaliacao: "avaliacoes",
  avaliacoes: "avaliacoes",
  avaliação: "avaliacoes",
  avaliações: "avaliacoes",
  resultado: "resultados",
  resultados: "resultados",
};

const removeSystemFields = (payload) => {
  const next = { ...(payload || {}) };
  delete next.id;
  delete next.created_at;
  delete next.updated_at;
  return next;
};

const normalizePayload = (entityKey, payload, { ensureDefaults = false } = {}) => {
  const normalized = removeSystemFields(payload);

  const hasAlternativas = Object.prototype.hasOwnProperty.call(payload || {}, "alternativas");
  if (entityKey === "questoes" && (ensureDefaults || hasAlternativas)) {
    normalized.alternativas = Array.isArray(payload?.alternativas) ? payload.alternativas : [];
  }

  const hasQuestoesIds = Object.prototype.hasOwnProperty.call(payload || {}, "questoes_ids");
  if (entityKey === "avaliacoes" && (ensureDefaults || hasQuestoesIds)) {
    normalized.questoes_ids = Array.isArray(payload?.questoes_ids) ? payload.questoes_ids : [];
  }

  const hasRespostas = Object.prototype.hasOwnProperty.call(payload || {}, "respostas");
  if (entityKey === "resultados" && (ensureDefaults || hasRespostas)) {
    normalized.respostas = Array.isArray(payload?.respostas) ? payload.respostas : [];
  }

  return normalized;
};

const serializeRow = (row) => ({
  ...(row.data || {}),
  id: row.id,
  owner_id: row.owner_id,
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
});

const isAdmin = (actor) => actor?.role === "admin";

export const resolveEntityKey = (entity) => {
  const normalized = String(entity || "").trim().toLowerCase();
  return ENTITY_ALIASES[normalized] || null;
};

export const listEntities = async (entityKey, actor) => {
  const { rows } = isAdmin(actor)
    ? await query(
        `
          SELECT id, owner_id, data, created_at, updated_at
          FROM app_entities
          WHERE entity_type = $1
          ORDER BY updated_at DESC
        `,
        [entityKey]
      )
    : await query(
        `
          SELECT id, owner_id, data, created_at, updated_at
          FROM app_entities
          WHERE entity_type = $1 AND owner_id = $2
          ORDER BY updated_at DESC
        `,
        [entityKey, actor?.id]
      );

  return rows.map(serializeRow);
};

export const getEntityById = async (entityKey, id, actor) => {
  const { rows } = isAdmin(actor)
    ? await query(
        `
          SELECT id, owner_id, data, created_at, updated_at
          FROM app_entities
          WHERE entity_type = $1 AND id = $2
          LIMIT 1
        `,
        [entityKey, id]
      )
    : await query(
        `
          SELECT id, owner_id, data, created_at, updated_at
          FROM app_entities
          WHERE entity_type = $1 AND id = $2 AND owner_id = $3
          LIMIT 1
        `,
        [entityKey, id, actor?.id]
      );

  const row = rows[0];
  return row ? serializeRow(row) : null;
};

export const createEntity = async (entityKey, payload, actor) => {
  const id = randomUUID();
  const data = normalizePayload(entityKey, payload, { ensureDefaults: true });
  const ownerId = actor?.id || null;

  const { rows } = await query(
    `
      INSERT INTO app_entities (id, entity_type, owner_id, data)
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING id, owner_id, data, created_at, updated_at
    `,
    [id, entityKey, ownerId, JSON.stringify(data)]
  );

  return serializeRow(rows[0]);
};

export const updateEntity = async (entityKey, id, payload, actor) => {
  const current = await getEntityById(entityKey, id, actor);
  if (!current) return null;

  const nextData = {
    ...removeSystemFields(current),
    ...normalizePayload(entityKey, payload, { ensureDefaults: false }),
  };

  const { rows } = isAdmin(actor)
    ? await query(
        `
          UPDATE app_entities
          SET data = $3::jsonb, updated_at = NOW()
          WHERE entity_type = $1 AND id = $2
          RETURNING id, owner_id, data, created_at, updated_at
        `,
        [entityKey, id, JSON.stringify(nextData)]
      )
    : await query(
        `
          UPDATE app_entities
          SET data = $4::jsonb, updated_at = NOW()
          WHERE entity_type = $1 AND id = $2 AND owner_id = $3
          RETURNING id, owner_id, data, created_at, updated_at
        `,
        [entityKey, id, actor?.id, JSON.stringify(nextData)]
      );

  const row = rows[0];
  return row ? serializeRow(row) : null;
};

export const deleteEntity = async (entityKey, id, actor) => {
  const { rowCount } = isAdmin(actor)
    ? await query(
        `
          DELETE FROM app_entities
          WHERE entity_type = $1 AND id = $2
        `,
        [entityKey, id]
      )
    : await query(
        `
          DELETE FROM app_entities
          WHERE entity_type = $1 AND id = $2 AND owner_id = $3
        `,
        [entityKey, id, actor?.id]
      );

  return rowCount > 0;
};
