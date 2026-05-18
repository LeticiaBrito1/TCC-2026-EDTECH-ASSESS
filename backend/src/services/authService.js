import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, randomBytes, randomInt } from "node:crypto";
import { env } from "../config/env.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByIdWithHash,
  findUserByVerificationToken,
  markEmailVerified,
  setVerificationToken,
  setLoginCode,
  clearLoginCode,
  updateUser,
  updateUserPassword,
  incrementTokenVersion,
} from "../models/authModel.js";
import { sendVerificationEmail, sendLoginCodeEmail } from "./emailService.js";
import { HttpError } from "../utils/httpError.js";

const sanitizeUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
  active: user.active,
  email_verified: user.email_verified ?? false,
});

const signToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.token_version ?? 0,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

const generateVerificationToken = () => randomBytes(32).toString("hex");

export const authService = {
  async register({ full_name, email, password }) {
    const existing = await findUserByEmail(email);
    if (existing) {
      throw new HttpError(409, "Este e-mail já está cadastrado.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await createUser({
      id: randomUUID(),
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      role: "professor",
      verification_token: verificationToken,
      verification_expires: verificationExpires,
    });

    await sendVerificationEmail({
      toEmail: user.email,
      toName: user.full_name,
      token: verificationToken,
    });

    return {
      message: "Cadastro realizado. Verifique seu e-mail para ativar a conta.",
      email: user.email,
    };
  },

  async verifyEmail(token) {
    if (!token) throw new HttpError(400, "Token de verificação ausente.");

    const user = await findUserByVerificationToken(token);
    if (!user) throw new HttpError(400, "Link de verificação inválido ou já utilizado.");

    if (user.email_verified) {
      return { message: "E-mail já verificado. Faça login para continuar." };
    }

    if (new Date() > new Date(user.verification_expires)) {
      throw new HttpError(410, "Link de verificação expirado. Solicite um novo.");
    }

    await markEmailVerified(user.id);
    return { message: "E-mail confirmado com sucesso! Agora você pode fazer login." };
  },

  async resendVerification(email) {
    if (!email) throw new HttpError(400, "E-mail obrigatório.");

    const user = await findUserByEmail(email);
    // Resposta genérica para não confirmar se o e-mail existe
    if (!user || user.email_verified) {
      return { message: "Se o e-mail estiver cadastrado e não verificado, você receberá um novo link em breve." };
    }

    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await setVerificationToken(user.id, verificationToken, verificationExpires);
    await sendVerificationEmail({
      toEmail: user.email,
      toName: user.full_name,
      token: verificationToken,
    });

    return { message: "Novo link de verificação enviado. Verifique sua caixa de entrada." };
  },

  async login({ email, password }) {
    const user = await findUserByEmail(email);
    if (!user) throw new HttpError(401, "Credenciais inválidas.");
    if (!user.active) throw new HttpError(403, "Usuário inativo.");

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) throw new HttpError(401, "Credenciais inválidas.");

    if (!user.email_verified) {
      throw new HttpError(403, "E-mail não verificado. Confirme seu e-mail antes de fazer login.", {
        code: "email_not_verified",
        email: user.email,
      });
    }

    // Gera código de 6 dígitos e envia por e-mail
    const code = String(randomInt(100000, 1000000));
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await setLoginCode(user.id, code, expires);
    await sendLoginCodeEmail({ toEmail: user.email, toName: user.full_name, code });

    return { step: "code_required", email: user.email };
  },

  async verifyLoginCode({ email, code }) {
    const user = await findUserByEmail(email);
    if (!user || !user.active) throw new HttpError(401, "Código inválido ou expirado.");

    if (!user.login_code || user.login_code !== String(code).trim()) {
      throw new HttpError(401, "Código incorreto. Verifique seu e-mail e tente novamente.");
    }

    if (new Date() > new Date(user.login_code_expires)) {
      await clearLoginCode(user.id);
      throw new HttpError(410, "Código expirado. Faça login novamente para receber um novo código.");
    }

    await clearLoginCode(user.id);
    const token = signToken(user);
    return { token, user: sanitizeUser(user), expires_in: env.jwtExpiresIn };
  },

  async me(userId) {
    const user = await findUserById(userId);
    if (!user || !user.active) throw new HttpError(401, "Sessão inválida.");
    return sanitizeUser(user);
  },

  async updateProfile(userId, { full_name, email }) {
    const existing = await findUserByEmail(email);
    if (existing && existing.id !== userId) {
      throw new HttpError(409, "Este e-mail já está em uso por outro usuário.");
    }
    const updated = await updateUser(userId, { full_name, email });
    if (!updated) throw new HttpError(404, "Usuário não encontrado.");
    return sanitizeUser(updated);
  },

  async changePassword(userId, { senha_atual, nova_senha }) {
    const user = await findUserByIdWithHash(userId);
    if (!user) throw new HttpError(404, "Usuário não encontrado.");
    const matches = await bcrypt.compare(senha_atual, user.password_hash);
    if (!matches) throw new HttpError(401, "Senha atual incorreta.");
    const newHash = await bcrypt.hash(nova_senha, 12);
    await updateUserPassword(userId, newHash);
    await incrementTokenVersion(userId);
  },
};
