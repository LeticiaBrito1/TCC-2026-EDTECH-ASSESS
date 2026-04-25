import { getDatabaseMode } from "../config/database.js";

export const healthController = {
  check(_req, res) {
    const databaseMode = getDatabaseMode();
    const isPersistent = databaseMode === "postgres";

    res.json({
      status: "ok",
      service: "tcc-ia-backend",
      database_mode: databaseMode,
      database_persistent: isPersistent,
      warning: isPersistent ? "" : "Banco em memória (sem persistência).",
      timestamp: new Date().toISOString(),
    });
  },
};
