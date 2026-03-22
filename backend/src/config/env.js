export const env = {
  port: Number(process.env.PORT || 8787),
  frontendOrigins: (process.env.FRONTEND_ORIGIN || "http://localhost:5174")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  databaseUrl: String(process.env.DATABASE_URL || "").trim(),
  pgSsl: String(process.env.PGSSL || "false").toLowerCase() === "true",
  allowDbFallback: String(process.env.ALLOW_DB_FALLBACK || "true").toLowerCase() === "true",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
  jwtSecret: String(process.env.JWT_SECRET || "dev-secret").trim(),
  jwtExpiresIn: String(process.env.JWT_EXPIRES_IN || "12h").trim(),
  devAdminEmail: String(process.env.DEV_ADMIN_EMAIL || "admin@edtech.local").trim().toLowerCase(),
  devAdminPassword: String(process.env.DEV_ADMIN_PASSWORD || "123456").trim(),
  devAdminName: String(process.env.DEV_ADMIN_NAME || "Administrador").trim(),
  devProfessorEmail: String(process.env.DEV_PROFESSOR_EMAIL || "professor@edtech.local").trim().toLowerCase(),
  devProfessorPassword: String(process.env.DEV_PROFESSOR_PASSWORD || "123456").trim(),
  devProfessorName: String(process.env.DEV_PROFESSOR_NAME || "Professor").trim(),
  lmsWebhookUrl: String(process.env.LMS_WEBHOOK_URL || "").trim(),
  notificationsWebhookUrl: String(process.env.NOTIFICATIONS_WEBHOOK_URL || "").trim(),
};
