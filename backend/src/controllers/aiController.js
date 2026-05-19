import { z } from "zod";
import { randomUUID } from "node:crypto";
import { generateQuestions } from "../services/aiQuestionService.js";
import { auditService } from "../services/auditService.js";
import { HttpError } from "../utils/httpError.js";

const questionRequestSchema = z.object({
  titulo: z.string().min(2).max(200).optional(),
  tema: z.string().min(2).max(200),
  quantidade: z.coerce.number().int().min(1).max(20).default(5),
  nivel_dificuldade: z.enum(["facil", "medio", "dificil"]).default("medio"),
  competencia: z.string().max(200).optional(),
  contexto: z.string().max(4000).optional(),
  formato: z.string().optional(),
  linguagem: z.string().optional(),
});

export const aiController = {
  async generateQuestions(req, res) {
    const requestId = randomUUID().slice(0, 8);
    const startedAt = Date.now();

    console.log(`[ai][${requestId}] Recebida requisição de geração de questões.`, {
      user_id: req.user?.id || null,
      method: req.method,
      path: req.originalUrl || req.url,
    });

    const parsed = questionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn(`[ai][${requestId}] Payload inválido para geração de questões.`, {
        issues: parsed.error.issues?.length || 0,
      });
      throw new HttpError(400, "Payload inválido.", parsed.error.flatten());
    }

    console.log(`[ai][${requestId}] Payload validado.`, {
      tema: parsed.data.tema,
      quantidade: parsed.data.quantidade,
      nivel_dificuldade: parsed.data.nivel_dificuldade,
      competencia: parsed.data.competencia || "",
      contexto_chars: String(parsed.data.contexto || "").length,
    });

    try {
      const result = await generateQuestions(parsed.data);
      console.log(`[ai][${requestId}] Geração concluída.`, {
        source: result.source,
        model: result.model || "",
        reason: result.reason || "",
        questions: Array.isArray(result.questions) ? result.questions.length : 0,
      });

      await auditService.log({
        userId: req.user?.id,
        action: "ai.generate_questions",
        entityType: "avaliacoes",
        details: {
          tema: parsed.data.tema,
          quantidade: parsed.data.quantidade,
          source: result.source,
        },
      });

      res.json({
        source: result.source,
        model: result.model,
        reason: result.reason || "",
        questions: result.questions,
      });

      console.log(`[ai][${requestId}] Resposta enviada.`, {
        duration_ms: Date.now() - startedAt,
      });
    } catch (error) {
      console.error(`[ai][${requestId}] Falha durante geração.`, {
        duration_ms: Date.now() - startedAt,
        message: error?.message || "erro desconhecido",
      });
      throw error;
    }
  },
};
