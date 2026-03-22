import { z } from "zod";
import { correctionService } from "../services/correctionService.js";
import { HttpError } from "../utils/httpError.js";

const ocrPayloadSchema = z.object({
  avaliacao_id: z.string().uuid(),
  aluno_id: z.string().uuid(),
  image_base64: z.string().optional(),
  recognized_text: z.string().optional(),
});

export const correctionController = {
  async correctByOcr(req, res) {
    const parsed = ocrPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Payload inválido.", parsed.error.flatten());
    }

    if (!parsed.data.image_base64 && !parsed.data.recognized_text) {
      throw new HttpError(400, "Envie image_base64 ou recognized_text para corrigir.");
    }

    const result = await correctionService.correctByOcr(
      {
        avaliacaoId: parsed.data.avaliacao_id,
        alunoId: parsed.data.aluno_id,
        imageBase64: parsed.data.image_base64,
        recognizedText: parsed.data.recognized_text,
      },
      req.user
    );

    res.json(result);
  },
};
