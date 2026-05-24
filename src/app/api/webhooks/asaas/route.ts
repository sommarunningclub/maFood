/*
  Webhook do Asaas — recebe notificações de mudança de status do pagamento.
  Configurar URL no painel Asaas: https://<host>/api/webhooks/asaas
  + header customizado `asaas-access-token: <ASAAS_WEBHOOK_TOKEN>`.

  Eventos relevantes (https://docs.asaas.com/docs/webhooks):
  - PAYMENT_CONFIRMED: cobrança paga, ainda não compensada
  - PAYMENT_RECEIVED: valor disponível (Pix é instantâneo, geralmente vem junto)
  - PAYMENT_DELETED / PAYMENT_REFUNDED: tratar como cancelado

  Idempotência: usar asaas_payment_id como chave; re-eventos não devem duplicar
  estados terminais.
*/
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidWebhookToken } from "@/lib/asaas";

interface AsaasWebhookEvent {
  event: string;
  payment?: {
    id: string;
    status: string;
    externalReference?: string;
  };
}

export async function POST(req: Request) {
  const token = req.headers.get("asaas-access-token");
  if (!isValidWebhookToken(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  let evt: AsaasWebhookEvent;
  try {
    evt = (await req.json()) as AsaasWebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!evt.payment?.id) {
    return NextResponse.json({ ok: true, ignored: "no payment id" });
  }

  const supabase = createAdminClient();
  const paymentId = evt.payment.id;

  // Encontra a order pelo payment_id (única)
  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();

  if (!order) {
    // Pode ser ping de teste ou evento de outra origem
    return NextResponse.json({ ok: true, ignored: "order not found" });
  }

  const TERMINAL = ["delivered", "cancelled"];
  if (TERMINAL.includes(order.status)) {
    return NextResponse.json({ ok: true, ignored: "terminal state" });
  }

  switch (evt.event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      if (order.status === "pending") {
        await supabase
          .from("orders")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", order.id);
      }
      return NextResponse.json({ ok: true, action: "marked_paid" });
    }
    case "PAYMENT_DELETED":
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED": {
      if (order.status === "pending" || order.status === "paid") {
        await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      }
      return NextResponse.json({ ok: true, action: "cancelled" });
    }
    default:
      return NextResponse.json({ ok: true, ignored: evt.event });
  }
}
