import { getDatabaseMode } from "../config/database.js";

export const healthController = {
  check(_req, res) {
    res.json({
      status: "ok",
      service: "tcc-ia-backend",
      database_mode: getDatabaseMode(),
      timestamp: new Date().toISOString(),
    });
  },
};
