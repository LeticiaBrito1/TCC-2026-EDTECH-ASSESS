import { z } from "zod";
import { authService } from "../services/authService.js";
import { auditService } from "../services/auditService.js";
import { HttpError } from "../utils/httpError.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const authController = {
  async login(req, res) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Payload inválido.", parsed.error.flatten());
    }

    const payload = await authService.login(parsed.data);
    await auditService.log({
      userId: payload.user.id,
      action: "auth.login",
      entityType: "auth",
      details: { email: payload.user.email, role: payload.user.role },
    });

    res.json(payload);
  },

  async me(req, res) {
    const userId = req.user?.id;
    const user = await authService.me(userId);
    res.json(user);
  },
};
