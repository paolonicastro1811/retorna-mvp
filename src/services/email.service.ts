/**
 * EmailService — Envia emails via Resend (resend.com).
 *
 * Em desenvolvimento (sem RESEND_API_KEY):
 *   Loga o magic link no console.
 *
 * Em producao (RESEND_API_KEY set):
 *   Envia email real via Resend API.
 */

import { Resend } from "resend";

const APP_URL = process.env.APP_URL || "http://localhost:5173";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Retorna <onboarding@resend.dev>";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendMagicLinkEmail(
  to: string,
  token: string,
  restaurantName?: string
): Promise<void> {
  const magicLink = `${APP_URL}/auth/verificar?token=${token}`;
  const name = restaurantName || "seu restaurante";

  // Development fallback: log to console
  if (!resend) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Magic Link] Email para: ${to}`);
    console.log(`[Magic Link] URL: ${magicLink}`);
    console.log(`${"=".repeat(60)}\n`);
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f9fb">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

    <div style="background:#1a1a2e;padding:24px 32px;text-align:center">
      <h1 style="color:#25D366;font-size:20px;margin:0">Retorna</h1>
    </div>

    <div style="padding:32px">
      <p style="color:#2d2d3a;font-size:16px;margin:0 0 8px">Oi! 👋</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px">
        Alguem solicitou um link de acesso ao painel de <strong>${name}</strong>.
        Clique no botao abaixo para entrar:
      </p>

      <div style="text-align:center;margin:32px 0">
        <a href="${magicLink}"
           style="display:inline-block;background:#25D366;color:#fff;font-size:16px;font-weight:700;padding:14px 40px;border-radius:50px;text-decoration:none">
          Entrar no painel
        </a>
      </div>

      <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0 0 8px">
        Este link expira em <strong>15 minutos</strong> e so pode ser usado uma vez.
      </p>
      <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0">
        Se voce nao solicitou este acesso, ignore este email.
      </p>

      <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0" />

      <p style="color:#d1d5db;font-size:10px;margin:0">
        Link direto: <a href="${magicLink}" style="color:#d1d5db">${magicLink}</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Seu link de acesso — ${name}`,
    html,
  });

  if (error) {
    console.error(`[Email] Erro ao enviar para ${to}:`, error);
    // Fallback: log magic link to console so dev/testing can continue
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Magic Link FALLBACK] Email falhou, mas aqui esta o link:`);
    console.log(`[Magic Link] Email para: ${to}`);
    console.log(`[Magic Link] URL: ${magicLink}`);
    console.log(`${"=".repeat(60)}\n`);
    // Don't throw — allow login flow to continue in dev
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Falha ao enviar email: ${error.message}`);
    }
    return;
  }

  console.log(`[Email] Magic link enviado para ${to}`);
}
