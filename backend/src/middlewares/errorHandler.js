import { HttpError } from "../utils/httpError.js";

export const notFoundHandler = (_req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
};

export const errorHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: error.message,
      details: error.details,
    });
    return;
  }

  if (String(error?.message || "").includes("CORS")) {
    res.status(403).json({ error: "Requisição bloqueada por CORS." });
    return;
  }

  res.status(500).json({ error: "Erro interno no servidor." });
};
