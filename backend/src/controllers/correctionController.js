import { z } from "zod";
import { correctionService } from "../services/correctionService.js";
import { HttpError } from "../utils/httpError.js";

const ocrPayloadSchema = z.object({
  // IDs são opcionais quando a imagem é enviada — o modelo de visão os extrai do cartão resposta.
  avaliacao_id: z.string().uuid().optional(),
  aluno_id: z.string().uuid().optional(),
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

    // Se nenhum ID foi fornecido, o serviço tentará extraí-los da imagem via IA de visão.
    const result = await correctionService.correctByOcr(
      {
        avaliacaoId: parsed.data.avaliacao_id || null,
        alunoId: parsed.data.aluno_id || null,
        imageBase64: parsed.data.image_base64,
        recognizedText: parsed.data.recognized_text,
      },
      req.user
    );

    res.json(result);
  },
};
