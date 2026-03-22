import "dotenv/config";
import { app } from "./app.js";
import { initDatabase } from "./config/database.js";
import { env } from "./config/env.js";

const startServer = async () => {
  await initDatabase();

  app.listen(env.port, () => {
    console.log(`[backend] API rodando em http://localhost:${env.port}`);
  });
};

startServer().catch((error) => {
  console.error("[backend] Falha ao iniciar:", error.message);
  process.exit(1);
});
