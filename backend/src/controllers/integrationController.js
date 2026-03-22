import { z } from "zod";
import { integrationService } from "../services/integrationService.js";
import { HttpError } from "../utils/httpError.js";

const syncSchema = z.object({
  provider: z.enum(["moodle", "google_classroom", "teams", "custom"]),
  turma_id: z.string().uuid().optional(),
  avaliacao_id: z.string().uuid().optional(),
  include_resultados: z.coerce.boolean().default(false),
});

export const integrationController = {
  async syncLms(req, res) {
    const parsed = syncSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Payload inválido.", parsed.error.flatten());
    }

    const result = await integrationService.syncLms(
      {
        provider: parsed.data.provider,
        turmaId: parsed.data.turma_id,
        avaliacaoId: parsed.data.avaliacao_id,
        includeResultados: parsed.data.include_resultados,
      },
      req.user
    );

    res.json(result);
  },
};
