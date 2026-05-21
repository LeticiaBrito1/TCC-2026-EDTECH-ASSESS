import twilio from "twilio";
import { env } from "../config/env.js";

const client =
  env.twilioAccountSid && env.twilioAuthToken
    ? twilio(env.twilioAccountSid, env.twilioAuthToken)
    : null;

const send = async (to, body) => {
  const { sid } = await client.messages.create({
    from: env.twilioPhoneNumber,
    to,
    body,
  });
  return sid;
};

export const sendLoginCodeSms = async ({ toPhone, toName, code }) => {
  if (!client) {
    console.log("\n========================================");
    console.log("[sms] Twilio não configurado — código de login:");
    console.log(`[sms] Para: ${toPhone} (${toName})`);
    console.log(`[sms] Código: ${code}`);
    console.log("========================================\n");
    return { sent: false };
  }
  try {
    const sid = await send(toPhone, `EdTech Assess: seu código de acesso é ${code}. Expira em 10 minutos.`);
    console.log(`[sms] Código de login enviado para ${toPhone} (${sid})`);
    return { sent: true, sid };
  } catch (err) {
    console.error(`[sms] Falha ao enviar código: ${err.message}`);
    console.log("\n========================================");
    console.log(`[sms] FALLBACK — Código de login para ${toPhone}: ${code}`);
    console.log("========================================\n");
    return { sent: false, error: err.message };
  }
};

export const sendVerificationSms = async ({ toPhone, toName, code }) => {
  if (!client) {
    console.log("\n========================================");
    console.log("[sms] Twilio não configurado — código de verificação:");
    console.log(`[sms] Para: ${toPhone} (${toName})`);
    console.log(`[sms] Código: ${code}`);
    console.log("========================================\n");
    return { sent: false };
  }
  try {
    const sid = await send(toPhone, `EdTech Assess: seu código de verificação é ${code}. Expira em 24 horas.`);
    console.log(`[sms] Código de verificação enviado para ${toPhone} (${sid})`);
    return { sent: true, sid };
  } catch (err) {
    console.error(`[sms] Falha ao enviar verificação: ${err.message}`);
    console.log("\n========================================");
    console.log(`[sms] FALLBACK — Código de verificação para ${toPhone}: ${code}`);
    console.log("========================================\n");
    return { sent: false, error: err.message };
  }
};

export const sendPasswordResetSms = async ({ toPhone, toName, code }) => {
  if (!client) {
    console.log("\n========================================");
    console.log("[sms] Twilio não configurado — código de redefinição de senha:");
    console.log(`[sms] Para: ${toPhone} (${toName})`);
    console.log(`[sms] Código: ${code}`);
    console.log("========================================\n");
    return { sent: false };
  }
  try {
    const sid = await send(toPhone, `EdTech Assess: seu código de redefinição de senha é ${code}. Expira em 1 hora.`);
    console.log(`[sms] Código de redefinição enviado para ${toPhone} (${sid})`);
    return { sent: true, sid };
  } catch (err) {
    console.error(`[sms] Falha ao enviar redefinição: ${err.message}`);
    console.log("\n========================================");
    console.log(`[sms] FALLBACK — Código de redefinição para ${toPhone}: ${code}`);
    console.log("========================================\n");
    return { sent: false, error: err.message };
  }
};
