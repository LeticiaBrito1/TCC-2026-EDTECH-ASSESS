import { z } from "zod";
import { randomUUID } from "node:crypto";
import { authService } from "../services/authService.js";
import { auditService } from "../services/auditService.js";
import { HttpError } from "../utils/httpError.js";

// Mascara e-mail nos logs: user@example.com → u***@e***.com
const maskEmail = (email) => {
  const str = String(email || "");
  const [local, domain] = str.split("@");
  if (!domain) return "***";
  const maskedLocal = local[0] + "***";
  const [domainName, ...tld] = domain.split(".");
  const maskedDomain = domainName[0] + "***";
  return `${maskedLocal}@${maskedDomain}.${tld.join(".")}`;
};

const registerSchema = z.object({
  full_name: z.string().min(2, "Nome deve ter ao menos 2 caracteres.").max(200).trim(),
  email: z.string().email("E-mail inválido."),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.")
    .max(200)
    .refine(
      (val) => /[A-Za-z]/.test(val) && /[0-9]/.test(val),
      "A senha deve conter letras e números."
    ),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

const verifyLoginCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "O código deve ter 6 dígitos.").regex(/^\d{6}$/, "Código inválido."),
});

const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email(),
});

const changePasswordSchema = z.object({
  senha_atual: z.string().min(1),
  nova_senha: z
    .string()
    .min(8, "A nova senha deve ter no mínimo 8 caracteres.")
    .max(200)
    .refine(
      (val) => /[A-Za-z]/.test(val) && /[0-9]/.test(val),
      "A nova senha deve conter letras e números."
    ),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido."),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token ausente."),
  nova_senha: z
    .string()
    .min(8, "A nova senha deve ter no mínimo 8 caracteres.")
    .max(200)
    .refine(
      (val) => /[A-Za-z]/.test(val) && /[0-9]/.test(val),
      "A nova senha deve conter letras e números."
    ),
});

export const authController = {
  async register(req, res) {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Dados de cadastro inválidos.", parsed.error.flatten());
    }

    const result = await authService.register(parsed.data);
    res.status(201).json(result);
  },

  async verifyEmail(req, res) {
    const token = String(req.query.token || "").trim();
    const result = await authService.verifyEmail(token);
    res.json(result);
  },

  async resendVerification(req, res) {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const result = await authService.resendVerification(email);
    res.json(result);
  },

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
      email: maskEmail(parsed.data.email),
    });

    try {
      const payload = await authService.login(parsed.data);

      // Código 2FA enviado — audit log ocorre em verifyLoginCode
      res.json(payload);
      console.log(`[auth][${requestId}] Código 2FA enviado.`, {
        email: maskEmail(parsed.data.email),
        duration_ms: Date.now() - startedAt,
      });
    } catch (error) {
      console.error(`[auth][${requestId}] Falha no login.`, {
        email: maskEmail(parsed.data.email),
        message: error?.message || "erro desconhecido",
        duration_ms: Date.now() - startedAt,
      });
      throw error;
    }
  },

  async verifyLoginCode(req, res) {
    const parsed = verifyLoginCodeSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Dados inválidos.", parsed.error.flatten());

    const payload = await authService.verifyLoginCode(parsed.data);
    await auditService.log({
      userId: payload.user.id,
      action: "auth.login",
      entityType: "auth",
      details: { role: payload.user.role },
    });
    res.json(payload);
  },

  async updateProfile(req, res) {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Dados inválidos.", parsed.error.flatten());
    const updated = await authService.updateProfile(req.user.id, parsed.data);
    res.json(updated);
  },

  async changePassword(req, res) {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Dados inválidos.", parsed.error.flatten());
    await authService.changePassword(req.user.id, parsed.data);
    res.json({ ok: true });
  },

  async forgotPassword(req, res) {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "E-mail inválido.", parsed.error.flatten());
    const result = await authService.forgotPassword(parsed.data.email.trim().toLowerCase());
    res.json(result);
  },

  async resetPassword(req, res) {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Dados inválidos.", parsed.error.flatten());
    const result = await authService.resetPassword(parsed.data.token, parsed.data.nova_senha);
    res.json(result);
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

  // ── DEV ONLY: login direto sem 2FA, para testes automatizados ───────────────
  async devLogin(req, res) {
    if (process.env.ALLOW_DIRECT_LOGIN !== "true") {
      throw new HttpError(404, "Not found.");
    }
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Payload inválido.", parsed.error.flatten());
    }
    const result = await authService.devLogin(parsed.data);
    res.json(result);
  },

  async deleteAccount(req, res) {
    const schema = z.object({ senha_atual: z.string().min(1, "Informe sua senha para confirmar.") });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.errors[0]?.message || "Senha obrigatória.");
    }
    await authService.deleteAccount(req.user.id, parsed.data);
    res.status(204).send();
  },
};
