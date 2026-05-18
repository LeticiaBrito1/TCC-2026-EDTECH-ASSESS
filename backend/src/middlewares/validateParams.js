import { HttpError } from "../utils/httpError.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_ENTITY_TYPES = new Set([
  "turmas", "turma",
  "disciplinas", "disciplina",
  "alunos", "aluno",
  "questoes", "questao", "questões", "questão",
  "avaliacoes", "avaliacao", "avaliações", "avaliação",
  "resultados", "resultado",
]);

export const validateEntityParam = (req, _res, next) => {
  const entity = String(req.params.entity || "").trim().toLowerCase();
  if (!ALLOWED_ENTITY_TYPES.has(entity)) {
    next(new HttpError(404, "Entidade não suportada."));
    return;
  }
  next();
};

export const validateIdParam = (req, _res, next) => {
  const id = String(req.params.id || "").trim();
  if (!UUID_REGEX.test(id)) {
    next(new HttpError(400, "ID inválido. Formato UUID esperado."));
    return;
  }
  next();
};
