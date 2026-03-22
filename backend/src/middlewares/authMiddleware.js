import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

const parseBearerToken = (headerValue) => {
  const raw = String(headerValue || "").trim();
  if (!raw) return null;
  const [scheme, token] = raw.split(" ");
  if (!/^Bearer$/i.test(scheme) || !token) return null;
  return token.trim();
};

export const authenticate = (req, _res, next) => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    next(new HttpError(401, "Token de acesso ausente."));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch {
    next(new HttpError(401, "Token inválido ou expirado."));
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
