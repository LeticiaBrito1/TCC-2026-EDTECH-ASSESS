import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { findUserByIdWithVersion } from "../models/authModel.js";
import { HttpError } from "../utils/httpError.js";

const parseBearerToken = (headerValue) => {
  const raw = String(headerValue || "").trim();
  if (!raw) return null;
  const [scheme, token] = raw.split(" ");
  if (!/^Bearer$/i.test(scheme) || !token) return null;
  return token.trim();
};

export const authenticate = async (req, _res, next) => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    next(new HttpError(401, "Token de acesso ausente."));
    return;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch {
    next(new HttpError(401, "Token inválido ou expirado."));
    return;
  }

  try {
    // Verifica se o token foi invalidado por troca de senha
    const dbUser = await findUserByIdWithVersion(decoded.sub);
    if (!dbUser || !dbUser.active) {
      next(new HttpError(401, "Sessão inválida."));
      return;
    }

    const tokenVersion = decoded.tv ?? 0;
    if (tokenVersion !== dbUser.token_version) {
      next(new HttpError(401, "Sessão expirada. Faça login novamente."));
      return;
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch {
    next(new HttpError(500, "Erro ao validar sessão."));
  }
};

export const requireRoles = (...allowedRoles) => (req, _res, next) => {
  const role = req.user?.role;
  if (!role || !allowedRoles.includes(role)) {
    next(new HttpError(403, "Você não tem permissão para esta ação."));
    return;
  }
  next();
};
