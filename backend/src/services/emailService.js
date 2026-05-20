import { Resend } from "resend";
import { env } from "../config/env.js";

// Usa API HTTP do Resend (porta 443) — SMTP é bloqueado em clouds como Railway
const apiKey = process.env.RESEND_API_KEY || env.smtpPass;
const resend = apiKey?.startsWith("re_") ? new Resend(apiKey) : null;
const FROM = `EdTech Assess <${env.smtpFrom || "onboarding@resend.dev"}>`;

const send = async ({ to, subject, html, text }) => {
  const { data, error } = await resend.emails.send({ from: FROM, to, subject, html, text });
  if (error) throw new Error(error.message);
  return data?.id;
};

export const sendLoginCodeEmail = async ({ toEmail, toName, code }) => {
  if (!resend) {
    console.log("\n========================================");
    console.log("[email] Resend não configurado — código de login:");
    console.log(`[email] Para: ${toEmail} (${toName})`);
    console.log(`[email] Código: ${code}`);
    console.log("========================================\n");
    return { sent: false };
  }

  try {
    const id = await send({
      to: toEmail,
      subject: "Seu código de acesso — EdTech Assess",
      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
                <tr>
                  <td style="background:#0f172a;padding:32px 40px;text-align:center">
                    <span style="color:#22d3ee;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase">EdTech Assess</span>
                    <h1 style="color:#ffffff;margin:12px 0 0;font-size:22px;font-weight:800">Código de acesso</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px;text-align:center">
                    <p style="color:#334155;font-size:15px;margin:0 0 28px">Olá, <strong>${toName}</strong>! Use o código abaixo para concluir seu login:</p>
                    <div style="display:inline-block;background:#f8fafc;border:2px solid #e2e8f0;border-radius:16px;padding:24px 48px;margin-bottom:28px">
                      <span style="font-size:42px;font-weight:900;letter-spacing:12px;color:#0f172a;font-family:monospace">${code}</span>
                    </div>
                    <p style="color:#64748b;font-size:13px;margin:0">Este código expira em <strong>10 minutos</strong>.</p>
                    <p style="color:#94a3b8;font-size:12px;margin:16px 0 0">Se você não tentou fazer login, ignore este e-mail.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
      text: `Olá, ${toName}!\n\nSeu código de acesso ao EdTech Assess: ${code}\n\nEste código expira em 10 minutos.`,
    });
    console.log(`[email] Código de login enviado para ${toEmail} (${id})`);
    return { sent: true, messageId: id };
  } catch (err) {
    console.error(`[email] Falha ao enviar código: ${err.message}`);
    console.log("\n========================================");
    console.log(`[email] FALLBACK — Código de login para ${toEmail}: ${code}`);
    console.log("========================================\n");
    return { sent: false, error: err.message };
  }
};

export const sendPasswordResetEmail = async ({ toEmail, toName, token }) => {
  const resetUrl = `${env.appUrl}/reset-password?token=${token}`;

  if (!resend) {
    console.log("\n========================================");
    console.log("[email] Resend não configurado — link de redefinição de senha:");
    console.log(`[email] Para: ${toEmail} (${toName})`);
    console.log(`[email] Link: ${resetUrl}`);
    console.log("========================================\n");
    return { sent: false, previewUrl: resetUrl };
  }

  try {
    const id = await send({
      to: toEmail,
      subject: "Redefinição de senha — EdTech Assess",
      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
                <tr>
                  <td style="background:#0f172a;padding:32px 40px;text-align:center">
                    <span style="color:#22d3ee;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase">EdTech Assess</span>
                    <h1 style="color:#ffffff;margin:12px 0 0;font-size:22px;font-weight:800">Redefinição de senha</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px">
                    <p style="color:#334155;font-size:15px;margin:0 0 12px">Olá, <strong>${toName}</strong>!</p>
                    <p style="color:#334155;font-size:15px;margin:0 0 28px">
                      Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.
                    </p>
                    <div style="text-align:center;margin-bottom:32px">
                      <a href="${resetUrl}"
                         style="display:inline-block;background:#0891b2;color:#ffffff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none">
                        Redefinir senha
                      </a>
                    </div>
                    <p style="color:#64748b;font-size:13px;margin:0 0 8px">
                      Se o botão não funcionar, copie e cole este link no navegador:
                    </p>
                    <p style="color:#0891b2;font-size:12px;word-break:break-all;margin:0 0 28px">
                      ${resetUrl}
                    </p>
                    <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px">
                    <p style="color:#94a3b8;font-size:12px;margin:0">
                      Este link expira em <strong>1 hora</strong>. Se você não solicitou a redefinição, ignore este e-mail — sua senha não será alterada.
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
      text: `Olá, ${toName}!\n\nRedefinição de senha — EdTech Assess\n\n${resetUrl}\n\nEste link expira em 1 hora.`,
    });
    console.log(`[email] Link de redefinição enviado para ${toEmail} (${id})`);
    return { sent: true, messageId: id };
  } catch (err) {
    console.error(`[email] Falha ao enviar redefinição: ${err.message}`);
    console.log("\n========================================");
    console.log("[email] FALLBACK — link de redefinição:");
    console.log(`[email] Para: ${toEmail} (${toName})`);
    console.log(`[email] Link: ${resetUrl}`);
    console.log("========================================\n");
    return { sent: false, error: err.message };
  }
};

export const sendVerificationEmail = async ({ toEmail, toName, token }) => {
  const verificationUrl = `${env.appUrl}/verify-email?token=${token}`;

  if (!resend) {
    console.log("\n========================================");
    console.log("[email] Resend não configurado — link de verificação:");
    console.log(`[email] Para: ${toEmail} (${toName})`);
    console.log(`[email] Link: ${verificationUrl}`);
    console.log("========================================\n");
    return { sent: false, previewUrl: verificationUrl };
  }

  try {
    const id = await send({
      to: toEmail,
      subject: "Confirme seu e-mail — EdTech Assess",
      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
                <tr>
                  <td style="background:#0f172a;padding:32px 40px;text-align:center">
                    <span style="color:#22d3ee;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase">EdTech Assess</span>
                    <h1 style="color:#ffffff;margin:12px 0 0;font-size:22px;font-weight:800">Confirme seu e-mail</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px">
                    <p style="color:#334155;font-size:15px;margin:0 0 12px">Olá, <strong>${toName}</strong>!</p>
                    <p style="color:#334155;font-size:15px;margin:0 0 28px">
                      Sua conta foi criada com sucesso. Clique no botão abaixo para confirmar seu e-mail e ativar o acesso à plataforma.
                    </p>
                    <div style="text-align:center;margin-bottom:32px">
                      <a href="${verificationUrl}"
                         style="display:inline-block;background:#0891b2;color:#ffffff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none">
                        Confirmar e-mail
                      </a>
                    </div>
                    <p style="color:#64748b;font-size:13px;margin:0 0 8px">
                      Se o botão não funcionar, copie e cole este link no navegador:
                    </p>
                    <p style="color:#0891b2;font-size:12px;word-break:break-all;margin:0 0 28px">
                      ${verificationUrl}
                    </p>
                    <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px">
                    <p style="color:#94a3b8;font-size:12px;margin:0">
                      Este link expira em <strong>24 horas</strong>. Se você não criou esta conta, ignore este e-mail.
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
      text: `Olá, ${toName}!\n\nConfirme seu e-mail clicando no link abaixo:\n${verificationUrl}\n\nEste link expira em 24 horas.`,
    });
    console.log(`[email] E-mail de verificação enviado para ${toEmail} (${id})`);
    return { sent: true, messageId: id };
  } catch (err) {
    console.error(`[email] Falha ao enviar verificação: ${err.message}`);
    console.log("\n========================================");
    console.log("[email] FALLBACK — link de verificação:");
    console.log(`[email] Para: ${toEmail} (${toName})`);
    console.log(`[email] Link: ${verificationUrl}`);
    console.log("========================================\n");
    return { sent: false, error: err.message };
  }
};
