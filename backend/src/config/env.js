const WEAK_SECRETS = new Set(["dev-secret", "secret", "changeme", "jwt-secret", "tcc", "123456", "password"]);

export const env = {
  nodeEnv: String(process.env.NODE_ENV || "development").trim().toLowerCase(),
  port: Number(process.env.PORT || 8787),
  frontendOrigins: (process.env.FRONTEND_ORIGIN || "http://localhost:5174")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  databaseUrl: String(process.env.DATABASE_URL || "").trim(),
  pgSsl: String(process.env.PGSSL || "false").toLowerCase() === "true",
  allowDbFallback: String(process.env.ALLOW_DB_FALLBACK || "false").toLowerCase() === "true",
  aiProvider: String(process.env.AI_PROVIDER || "groq").trim().toLowerCase(),
  groqApiKey: String(process.env.GROQ_API_KEY || "").trim(),
  groqModel: String(process.env.GROQ_MODEL || "llama-3.3-70b-versatile").trim(),
  openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
  ollamaBaseUrl: String(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434")
    .trim()
    .replace(/\/+$/, ""),
  ollamaModel: String(process.env.OLLAMA_MODEL || "llama3.2:3b").trim(),
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
  // E-mail / SMTP
  smtpHost: String(process.env.SMTP_HOST || "").trim(),
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: String(process.env.SMTP_USER || "").trim(),
  smtpPass: String(process.env.SMTP_PASS || "").trim(),
  smtpFrom: String(process.env.SMTP_FROM || "noreply@edtech.local").trim(),
  appUrl: String(process.env.APP_URL || "http://localhost:5174").trim().replace(/\/+$/, ""),
  // Twilio SMS
  twilioAccountSid: String(process.env.TWILIO_ACCOUNT_SID || "").trim(),
  twilioAuthToken: String(process.env.TWILIO_AUTH_TOKEN || "").trim(),
  twilioPhoneNumber: String(process.env.TWILIO_PHONE_NUMBER || "").trim(),
};

const jwtSecret = env.jwtSecret;
const isProduction = env.nodeEnv === "production";

if (WEAK_SECRETS.has(jwtSecret.toLowerCase()) || jwtSecret.length < 32) {
  if (isProduction) {
    console.error(
      "[security] CRÍTICO: JWT_SECRET fraco ou padrão detectado em ambiente de produção. " +
      "Defina um valor aleatório de pelo menos 32 caracteres antes de continuar."
    );
    process.exit(1);
  } else {
    console.warn(
      "[security] AVISO: JWT_SECRET fraco ou padrão. " +
      "Substitua por um valor aleatório de pelo menos 32 caracteres antes de ir para produção."
    );
  }
}
