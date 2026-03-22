import express from "express";
import cors from "cors";
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

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (env.frontendOrigins.includes("*") || env.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem não permitida pelo CORS."));
    },
  })
);

app.use(express.json({ limit: "1mb" }));

app.use("/api", healthRoutes);
app.use("/api", authRoutes);
app.use("/api", authenticate);
app.use("/api", entityRoutes);
app.use("/api", aiRoutes);
app.use("/api", auditRoutes);
app.use("/api", integrationRoutes);
app.use("/api", correctionRoutes);
app.use("/api", notificationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
