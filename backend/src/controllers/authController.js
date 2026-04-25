import { z } from "zod";
import { randomUUID } from "node:crypto";
import { authService } from "../services/authService.js";
import { auditService } from "../services/auditService.js";
import { HttpError } from "../utils/httpError.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const authController = {
  async login(req, res) {
    const requestId = randomUUID().slice(0, 8);
    const startedAt = Date.now();
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn(`[auth][${requestId}] Payload inválido no login.`, {
        issues: parsed.error.issues?.length || 0,
      });
      throw new HttpError(400, "Payload inválido.", parsed.error.flatten());
    }

    console.log(`[auth][${requestId}] Tentativa de login.`, {
      email: parsed.data.email,
    });

    try {
      const payload = await authService.login(parsed.data);
      await auditService.log({
        userId: payload.user.id,
        action: "auth.login",
        entityType: "auth",
        details: { email: payload.user.email, role: payload.user.role },
      });

      res.json(payload);
      console.log(`[auth][${requestId}] Login concluído.`, {
        user_id: payload.user.id,
        role: payload.user.role,
        duration_ms: Date.now() - startedAt,
      });
    } catch (error) {
      console.error(`[auth][${requestId}] Falha no login.`, {
        email: parsed.data.email,
        message: error?.message || "erro desconhecido",
        duration_ms: Date.now() - startedAt,
      });
      throw error;
    }
  },

  async me(req, res) {
    const requestId = randomUUID().slice(0, 8);
    const startedAt = Date.now();
    const userId = req.user?.id;
    console.log(`[auth][${requestId}] Consulta de sessão /auth/me.`, {
      user_id: userId || null,
    });

    try {
      const user = await authService.me(userId);
      res.json(user);
      console.log(`[auth][${requestId}] Sessão válida.`, {
        user_id: user.id,
        duration_ms: Date.now() - startedAt,
      });
    } catch (error) {
      console.error(`[auth][${requestId}] Sessão inválida em /auth/me.`, {
        user_id: userId || null,
        message: error?.message || "erro desconhecido",
        duration_ms: Date.now() - startedAt,
      });
      throw error;
    }
  },
};
