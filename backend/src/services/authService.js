import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, randomInt } from "node:crypto";
import { env } from "../config/env.js";
import {
  createUser,
  findUserByEmail,
  findUserByPhone,
  findUserById,
  findUserByIdWithHash,
  markEmailVerified,
  setLoginCode,
  clearLoginCode,
  setResetToken,
  clearResetToken,
  updateUser,
  updateUserPassword,
  incrementTokenVersion,
} from "../models/authModel.js";
import { sendVerificationSms, sendLoginCodeSms, sendPasswordResetSms } from "./smsService.js";
import { HttpError } from "../utils/httpError.js";

const sanitizeUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
  active: user.active,
  phone: user.phone ?? null,
  email_verified: user.email_verified ?? false,
});

const signToken = (user) =>
  jwt.sign(
    { sub: user.id, email: user.email, role: user.role, tv: user.token_version ?? 0 },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

const generateCode = () => String(randomInt(100000, 1000000));

export const authService = {
  async register({ full_name, email, password, phone }) {
    const existing = await findUserByEmail(email);
    if (existing) throw new HttpError(409, "Este e-mail já está cadastrado.");

    if (phone) {
      const existingPhone = await findUserByPhone(phone);
      if (existingPhone) throw new HttpError(409, "Este telefone já está cadastrado.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const code = generateCode();
    const codeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await createUser({
      id: randomUUID(),
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      role: "professor",
      phone: phone?.trim() || null,
      verification_token: null,
      verification_expires: null,
    });

    // Guarda código de verificação no campo login_code
    await setLoginCode(user.id, code, codeExpires);

    await sendVerificationSms({ toPhone: phone, toName: user.full_name, code });

    return { step: "verify_phone", phone, message: "Código enviado por SMS. Verifique seu celular." };
  },

  async verifyPhone({ phone, code }) {
    const user = await findUserByPhone(phone);
    if (!user) throw new HttpError(400, "Telefone não encontrado.");

    if (user.email_verified) return { message: "Conta já verificada. Faça login." };

    if (!user.login_code || user.login_code !== String(code).trim()) {
      throw new HttpError(401, "Código incorreto. Verifique o SMS e tente novamente.");
    }
    if (new Date() > new Date(user.login_code_expires)) {
      await clearLoginCode(user.id);
      throw new HttpError(410, "Código expirado. Faça o cadastro novamente para receber um novo.");
    }

    await clearLoginCode(user.id);
    await markEmailVerified(user.id);
    return { message: "Conta verificada com sucesso! Agora você pode fazer login." };
  },

  async login({ email, password }) {
    const user = await findUserByEmail(email);
    if (!user) throw new HttpError(401, "Credenciais inválidas.");
    if (!user.active) throw new HttpError(403, "Usuário inativo.");

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) throw new HttpError(401, "Credenciais inválidas.");

    if (!user.email_verified) {
      throw new HttpError(403, "Conta não verificada. Verifique seu celular antes de fazer login.", {
        code: "phone_not_verified",
        phone: user.phone,
      });
    }

    const code = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await setLoginCode(user.id, code, expires);
    await sendLoginCodeSms({ toPhone: user.phone, toName: user.full_name, code });

    return { step: "code_required", phone: user.phone, email: user.email };
  },

  async verifyLoginCode({ email, code }) {
    const user = await findUserByEmail(email);
    if (!user || !user.active) throw new HttpError(401, "Código inválido ou expirado.");

    if (!user.login_code || user.login_code !== String(code).trim()) {
      throw new HttpError(401, "Código incorreto. Verifique o SMS e tente novamente.");
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
    if (existing && existing.id !== userId) throw new HttpError(409, "Este e-mail já está em uso.");
    const updated = await updateUser(userId, { full_name, email });
    if (!updated) throw new HttpError(404, "Usuário não encontrado.");
    return sanitizeUser(updated);
  },

  async forgotPassword(phone) {
    const user = await findUserByPhone(phone);
    if (!user || !user.active || !user.email_verified) {
      return { message: "Se o telefone estiver cadastrado e verificado, você receberá um código em breve." };
    }

    const code = generateCode();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await setResetToken(user.id, code, expires);
    await sendPasswordResetSms({ toPhone: user.phone, toName: user.full_name, code });

    return { step: "code_required", message: "Código enviado por SMS." };
  },

  async resetPassword(phone, code, novaSenha) {
    const user = await findUserByPhone(phone);
    if (!user || !user.active) throw new HttpError(400, "Telefone inválido.");

    if (!user.reset_token || user.reset_token !== String(code).trim()) {
      throw new HttpError(401, "Código incorreto.");
    }
    if (new Date() > new Date(user.reset_token_expires)) {
      await clearResetToken(user.id);
      throw new HttpError(410, "Código expirado. Solicite um novo.");
    }

    const newHash = await bcrypt.hash(novaSenha, 12);
    await updateUserPassword(user.id, newHash);
    await clearResetToken(user.id);
    await incrementTokenVersion(user.id);

    return { message: "Senha redefinida com sucesso. Faça login com a nova senha." };
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
