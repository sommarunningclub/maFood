/*
  Webhook do Asaas — recebe notificações de mudança de status do pagamento.
  Configurar URL no painel Asaas: https://<host>/api/webhooks/asaas
  + header customizado `asaas-access-token: <ASAAS_WEBHOOK_TOKEN>`.

  ⚠️ CRÍTICO: o Asaas pausa a fila de eventos se receber 4xx/5xx (exceto 401).
  Logo, qualquer erro interno (JSON ruim, DB fora, evento desconhecido)
  DEVE responder 200 — caso contrário, perdemos confirmações até alguém
  reativar manualmente no painel Asaas.

  Eventos relevantes (https://docs.asaas.com/docs/webhook-para-cobrancas):
  - PAYMENT_CONFIRMED: cobrança paga (Pix instantâneo geralmente)
  - PAYMENT_RECEIVED:  valor disponível
  - PAYMENT_DELETED / PAYMENT_REFUNDED: cancelado
  - PAYMENT_OVERDUE:   venceu sem pagar
*/
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidWebhookToken } from "@/lib/asaas";

interface AsaasWebhookEvent {
  id?: string;
  event?: string;
  payment?: {
    id: string;
    status?: string;
    externalReference?: string;
  };
}

// Helper: resposta 200 com payload informativo (não pausa a fila)
const ack = (data: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...data });

export async function POST(req: Request) {
  // 1. Validar token — 401 é a ÚNICA resposta de erro permitida
  const token = req.headers.get("asaas-access-token");
  if (!isValidWebhookToken(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  // 2. Parse JSON tolerante — JSON ruim ainda volta 200
  let evt: AsaasWebhookEvent;
  try {
    evt = (await req.json()) as AsaasWebhookEvent;
  } catch {
    return ack({ ignored: "invalid json" });
  }

  if (!evt.event || !evt.payment?.id) {
    return ack({ ignored: "missing event/payment" });
  }

  try {
    const supabase = createAdminClient();
    const paymentId = evt.payment.id;

    const { data: order } = await supabase
      .from("orders")
      .select("id, status")
      .eq("asaas_payment_id", paymentId)
      .maybeSingle();

    if (!order) {
      // Ping de teste, evento de outra origem, ou cobrança fora do maFood
      return ack({ ignored: "order not found", payment_id: paymentId });
    }

    // Estados terminais — webhook de re-tentativa não deve regredir
    if (order.status === "delivered" || order.status === "cancelled") {
      return ack({ ignored: "terminal state", state: order.status });
    }

    switch (evt.event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        if (order.status === "pending") {
          const { error } = await supabase
            .from("orders")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", order.id);
          if (error) {
            console.error("[asaas-webhook] DB update failed", { id: order.id, error });
            return ack({ db_error: true });
          }
        }
        return ack({ action: "marked_paid", order_id: order.id });
      }

      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED":
      case "PAYMENT_CHARGEBACK_REQUESTED": {
        if (order.status === "pending" || order.status === "paid") {
          await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
        }
        return ack({ action: "cancelled", order_id: order.id });
      }

      case "PAYMENT_OVERDUE": {
        // Mantém pending — opcional: marcar cancelled após X horas
        return ack({ action: "noted_overdue", order_id: order.id });
      }

      default:
        return ack({ ignored: evt.event });
    }
  } catch (err) {
    console.error("[asaas-webhook] uncaught", err);
    // Mesmo em erro inesperado, retornar 200 evita travar a fila
    return ack({ error: err instanceof Error ? err.message : "unknown" });
  }
}

// GET pra health-check rápido (Asaas testa a URL antes de habilitar)
export async function GET() {
  return NextResponse.json({ ok: true, service: "mafood-asaas-webhook" });
}
