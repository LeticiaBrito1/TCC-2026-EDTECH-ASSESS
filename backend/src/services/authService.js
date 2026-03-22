import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { findUserByEmail, findUserById } from "../models/authModel.js";
import { HttpError } from "../utils/httpError.js";

const sanitizeUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
  active: user.active,
});

const signToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

export const authService = {
  async login({ email, password }) {
    const user = await findUserByEmail(email);
    if (!user) {
      throw new HttpError(401, "Credenciais inválidas.");
    }

    if (!user.active) {
      throw new HttpError(403, "Usuário inativo.");
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      throw new HttpError(401, "Credenciais inválidas.");
    }

    const token = signToken(user);
    return {
      token,
      user: sanitizeUser(user),
      expires_in: env.jwtExpiresIn,
    };
  },

  async me(userId) {
    const user = await findUserById(userId);
    if (!user || !user.active) {
      throw new HttpError(401, "Sessão inválida.");
    }

    return sanitizeUser(user);
  },
};
