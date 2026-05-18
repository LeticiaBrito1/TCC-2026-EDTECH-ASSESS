import { HttpError } from "../utils/httpError.js";

export const notFoundHandler = (_req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
};

export const errorHandler = (error, req, res, _next) => {
  if (error instanceof HttpError) {
    // Erros operacionais esperados: retorna detalhes para o cliente
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

  // Erros inesperados: loga no servidor, nunca expõe detalhes internos ao cliente
  console.error("[errorHandler] Erro interno não tratado.", {
    method: req.method,
    path: req.originalUrl || req.url,
    message: error?.message || "sem mensagem",
    stack: error?.stack || "sem stack",
  });

  res.status(500).json({ error: "Erro interno no servidor." });
};
