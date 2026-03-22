import { env } from "../config/env.js";
import { entityRepository } from "../repositories/entityRepository.js";
import { auditService } from "./auditService.js";
import { HttpError } from "../utils/httpError.js";

const SUPPORTED_PROVIDERS = new Set(["moodle", "google_classroom", "teams", "custom"]);

const cleanProvider = (value) => String(value || "").trim().toLowerCase();

const fetchAssessmentContext = async ({ actor, avaliacaoId, turmaId, includeResultados }) => {
  let avaliacao = null;
  if (avaliacaoId) {
    avaliacao = await entityRepository.getById("avaliacoes", avaliacaoId, actor);
    if (!avaliacao) {
      throw new HttpError(404, "Avaliação não encontrada para sincronização.");
    }
  }

  let turma = null;
  const effectiveTurmaId = turmaId || avaliacao?.turma_id;
  if (effectiveTurmaId) {
    turma = await entityRepository.getById("turmas", effectiveTurmaId, actor);
    if (!turma) {
      throw new HttpError(404, "Turma não encontrada para sincronização.");
    }
  }

  const alunos = effectiveTurmaId
    ? (await entityRepository.list("alunos", actor)).filter((item) => item.turma_id === effectiveTurmaId)
    : [];

  const resultados = includeResultados
    ? (await entityRepository.list("resultados", actor)).filter((item) => {
        if (avaliacao?.id && item.avaliacao_id !== avaliacao.id) return false;
        if (effectiveTurmaId && item.turma_id !== effectiveTurmaId) return false;
        return true;
      })
    : [];

  return { avaliacao, turma, alunos, resultados };
};

const buildLmsPayload = ({ provider, context, actor }) => ({
  provider,
  generated_at: new Date().toISOString(),
  by_user: {
    id: actor?.id || null,
    email: actor?.email || null,
    role: actor?.role || null,
  },
  turma: context.turma
    ? {
        id: context.turma.id,
        nome: context.turma.nome || "",
        ano_letivo: context.turma.ano_letivo || "",
      }
    : null,
  avaliacao: context.avaliacao
    ? {
        id: context.avaliacao.id,
        titulo: context.avaliacao.titulo || "",
        status: context.avaliacao.status || "",
        data_aplicacao: context.avaliacao.data_aplicacao || "",
      }
    : null,
  alunos: context.alunos.map((item) => ({
    id: item.id,
    nome: item.nome || "",
    matricula: item.matricula || "",
    email: item.email || "",
  })),
  resultados: context.resultados.map((item) => ({
    id: item.id,
    avaliacao_id: item.avaliacao_id,
    aluno_id: item.aluno_id,
    nota: item.nota,
    percentual_acerto: item.percentual_acerto,
    status: item.status,
  })),
});

const sendToWebhook = async (payload) => {
  if (!env.lmsWebhookUrl) {
    return { sent: false, status: null };
  }

  const response = await fetch(env.lmsWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return { sent: true, status: response.status };
};

export const integrationService = {
  async syncLms({ provider, turmaId, avaliacaoId, includeResultados = false }, actor) {
    const normalizedProvider = cleanProvider(provider);
    if (!SUPPORTED_PROVIDERS.has(normalizedProvider)) {
      throw new HttpError(400, "Provedor LMS não suportado.");
    }

    const context = await fetchAssessmentContext({
      actor,
      avaliacaoId,
      turmaId,
      includeResultados,
    });

    const payload = buildLmsPayload({
      provider: normalizedProvider,
      context,
      actor,
    });

    const transport = await sendToWebhook(payload);

    await auditService.log({
      userId: actor?.id,
      action: "integration.lms.sync",
      entityType: "integrations",
      details: {
        provider: normalizedProvider,
        turma_id: context.turma?.id || null,
        avaliacao_id: context.avaliacao?.id || null,
        sent: transport.sent,
        status: transport.status,
      },
    });

    return {
      provider: normalizedProvider,
      sent: transport.sent,
      webhook_status: transport.status,
      preview: {
        turma: context.turma
          ? { id: context.turma.id, nome: context.turma.nome || "" }
          : null,
        avaliacao: context.avaliacao
          ? { id: context.avaliacao.id, titulo: context.avaliacao.titulo || "" }
          : null,
        total_alunos: context.alunos.length,
        total_resultados: context.resultados.length,
      },
    };
  },
};
