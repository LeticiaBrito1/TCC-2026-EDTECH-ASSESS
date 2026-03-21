import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { generateQuestions } from "./services/aiQuestionService.js";

const app = express();

const PORT = Number(process.env.PORT || 8787);
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem não permitida pelo CORS."));
    },
  })
);

app.use(express.json({ limit: "1mb" }));

const questionRequestSchema = z.object({
  titulo: z.string().min(2).max(200).optional(),
  tema: z.string().min(2).max(200),
  quantidade: z.coerce.number().int().min(1).max(20).default(5),
  nivel_dificuldade: z.enum(["facil", "medio", "dificil"]).default("medio"),
  competencia: z.string().max(200).optional(),
  contexto: z.string().max(2000).optional(),
  formato: z.string().optional(),
  linguagem: z.string().optional(),
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "tcc-ia-backend",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/ai/generate-questions", async (req, res) => {
  const parsed = questionRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Payload inválido.",
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const result = await generateQuestions(parsed.data);
    res.json({
      source: result.source,
      model: result.model,
      questions: result.questions,
    });
  } catch {
    res.status(500).json({
      error: "Falha ao gerar questões.",
    });
  }
});

app.use((error, _req, res, _next) => {
  if (String(error?.message || "").includes("CORS")) {
    res.status(403).json({ error: "Requisição bloqueada por CORS." });
    return;
  }

  res.status(500).json({ error: "Erro interno no servidor." });
});

app.listen(PORT, () => {
  console.log(`[backend] API rodando em http://localhost:${PORT}`);
});
