import { Resend } from "resend";

/*
  Envia link de pagamento via Resend.
  Env vars (já configuradas pra projetos somma):
    - RESEND_API_KEY        (live key re_...)
    - VIP_EMAIL_FROM        (ex: "Somma Special Day <contato@sommaclub.com.br>")

  Em dev local sem chave → loga e retorna false (não bloqueia o fluxo).
*/

interface SendPaymentLinkArgs {
  to: string;
  customerName: string;
  pdvName: string;
  orderNumber: number;
  totalBrl: string;
  payUrl: string;
}

export async function sendPaymentLinkEmail({
  to,
  customerName,
  pdvName,
  orderNumber,
  totalBrl,
  payUrl,
}: SendPaymentLinkArgs): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.VIP_EMAIL_FROM;

  if (!apiKey || !from) {
    console.error("[payment-link-email] RESEND_API_KEY ou VIP_EMAIL_FROM ausentes");
    return { ok: false, error: "Email não configurado no servidor" };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: `Pagamento do pedido #${orderNumber} · ${pdvName} · maFood`,
    html: renderPaymentLinkEmail({ customerName, pdvName, orderNumber, totalBrl, payUrl }),
  });

  if (error) {
    console.error("[payment-link-email] Falha:", error);
    return { ok: false, error: error.message ?? "Falha ao enviar e-mail" };
  }
  return { ok: true };
}

function renderPaymentLinkEmail({
  customerName,
  pdvName,
  orderNumber,
  totalBrl,
  payUrl,
}: Omit<SendPaymentLinkArgs, "to">): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Pagamento maFood</title>
</head>
<body style="margin:0;padding:0;background:#080808;font-family:Helvetica,Arial,sans-serif;color:#F0F0F0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#141414;border:1px solid #2A2A2A;border-radius:12px;padding:32px;">
          <tr>
            <td>
              <p style="margin:0;font-size:11px;letter-spacing:3px;color:#F26522;text-transform:uppercase;">maFood</p>
              <h1 style="margin:8px 0 0;font-size:24px;color:#FFFFFF;">Pagamento do pedido #${orderNumber}</h1>
              <p style="margin:16px 0 0;font-size:14px;color:#A0A0A0;">
                Olá <strong style="color:#F0F0F0;">${escapeHtml(customerName)}</strong>! O ${escapeHtml(pdvName)} preparou o seu pedido. Finalize o pagamento clicando no botão abaixo:
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:8px;padding:16px;">
                    <p style="margin:0;font-size:11px;color:#A0A0A0;text-transform:uppercase;letter-spacing:2px;">Total</p>
                    <p style="margin:4px 0 0;font-size:28px;font-weight:bold;color:#FFFFFF;font-family:monospace;">${totalBrl}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${payUrl}" style="display:inline-block;background:#F26522;color:#FFFFFF;font-weight:bold;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;letter-spacing:2px;text-transform:uppercase;">
                      Pagar agora
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:11px;color:#A0A0A0;text-align:center;">
                Ou abra esse link no navegador:<br>
                <a href="${payUrl}" style="color:#F26522;word-break:break-all;">${payUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #2A2A2A;margin:24px 0;">
              <p style="margin:0;font-size:11px;color:#A0A0A0;text-align:center;">
                Pagamento processado pelo Asaas · maFood
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
