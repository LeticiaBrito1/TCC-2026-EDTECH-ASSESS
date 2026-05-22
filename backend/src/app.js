import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { entityRoutes } from "./routes/entityRoutes.js";
import { aiRoutes } from "./routes/aiRoutes.js";
import { auditRoutes } from "./routes/auditRoutes.js";
import { integrationRoutes } from "./routes/integrationRoutes.js";
import { correctionRoutes } from "./routes/correctionRoutes.js";
import { notificationRoutes } from "./routes/notificationRoutes.js";
import { authenticate } from "./middlewares/authMiddleware.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/ fica na raiz do projeto (dois níveis acima de backend/src/)
const DIST_PATH = path.join(__dirname, "../../dist");

const app = express();

// Trust proxy: necessário no Railway (e qualquer reverse proxy) para que
// express-rate-limit leia o IP real do X-Forwarded-For sem lançar ValidationError
app.set("trust proxy", 1);

// Health check — antes do CORS para que o Railway consiga verificar sem Origin header
app.use("/api", healthRoutes);

// Segurança: cabeçalhos HTTP (XSS, clickjacking, MIME sniffing, etc.)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Frontend separado gerencia seu próprio CSP
  })
);

// CORS com whitelist explícita
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        // Sem Origin header = requisição same-origin ou server-to-server.
        // Browsers só enviam Origin em requisições cross-origin, então
        // ausência de Origin nunca é uma violação de CORS.
        callback(null, true);
        return;
      }
      if (env.frontendOrigins.includes("*") || env.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origem não permitida pelo CORS."));
    },
    credentials: true,
  })
);

// Limite maior para OCR: envia imagem base64 de câmera (pode ter 3-8 MB)
app.use("/api/corrections", express.json({ limit: "15mb" }));
// Limite de corpo padrão para JSON geral
app.use(express.json({ limit: "1mb" }));

// Timeout maior para OCR: Groq Vision pode demorar com imagens grandes
app.use("/api/corrections", (_req, res, next) => {
  res.setTimeout(180_000, () => {
    res.status(408).json({ error: "Análise da imagem expirou (timeout). Tente uma foto mais nítida ou com melhor iluminação." });
  });
  next();
});

// Timeout padrão: 60s para todas as outras rotas
app.use((_req, res, next) => {
  res.setTimeout(60_000, () => {
    res.status(408).json({ error: "Requisição expirada (timeout)." });
  });
  next();
});

// Rate limiter: autenticação — max 20 tentativas/15 min por IP (brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." },
});

// Rate limiter: geração de IA — operação pesada, max 10/min por IP
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite de geração de IA atingido. Aguarde 1 minuto." },
});

// Auth: aplica rate limit nos endpoints sensíveis antes de montar as rotas
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/resend-verification", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth/change-password", authLimiter);
app.use("/api", authRoutes);

// Todas as rotas abaixo exigem autenticação
app.use("/api", authenticate);

// AI: rate limiter adicional após autenticação
app.use("/api/ai", aiLimiter);

app.use("/api", entityRoutes);
app.use("/api", aiRoutes);
app.use("/api", auditRoutes);
app.use("/api", integrationRoutes);
app.use("/api", correctionRoutes);
app.use("/api", notificationRoutes);

// Frontend SPA — serve arquivos estáticos do build e redireciona rotas não-API para index.html
app.use(express.static(DIST_PATH));
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(DIST_PATH, "index.html"));
});

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
