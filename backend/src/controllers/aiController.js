import { z } from "zod";
import { generateQuestions } from "../services/aiQuestionService.js";
import { auditService } from "../services/auditService.js";
import { HttpError } from "../utils/httpError.js";

const questionRequestSchema = z.object({
  titulo: z.string().min(2).max(200).optional(),
  tema: z.string().min(2).max(200),
  quantidade: z.coerce.number().int().min(1).max(20).default(5),
  nivel_dificuldade: z.enum(["facil", "medio", "dificil"]).default("medio"),
  competencia: z.string().max(200).optional(),
  contexto: z.string().max(2000).optional(),
  formato: z.string().optional(),
  linguagem: z.string().optional(),
});

export const aiController = {
  async generateQuestions(req, res) {
    const parsed = questionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Payload inválido.", parsed.error.flatten());
    }

    const result = await generateQuestions(parsed.data);
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
  },
};
