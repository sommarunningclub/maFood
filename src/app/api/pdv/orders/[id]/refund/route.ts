import { NextResponse } from "next/server";
import { z } from "zod";
import { getPdvSession } from "@/lib/auth/session";
import { refundPayment, type AsaasRefund } from "@/lib/asaas";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  internalErrorResponse,
  upstreamErrorResponse,
} from "@/lib/server-errors";

const Body = z.object({
  reason: z.string().trim().max(200).optional().default(""),
});

const REFUNDABLE_STATUSES = [
  "paid",
  "preparing",
  "ready",
  "partial",
  "delivered",
] as const;

type RefundState =
  | "requested"
  | "pending"
  | "partial"
  | "done"
  | "cancelled"
  | "failed";

function latestRefund(refunds: AsaasRefund[], status?: AsaasRefund["status"]) {
  return refunds
    .filter((refund) => !status || refund.status === status)
    .sort((a, b) => a.dateCreated.localeCompare(b.dateCreated))
    .at(-1);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getPdvSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : "Dados inválidos";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select(
      "id, pdv_id, number, total, method, status, asaas_payment_id, refund_status"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (readError) {
    return internalErrorResponse(
      "pdv-order-refund-read",
      readError,
      "Não foi possível consultar o pedido"
    );
  }
  if (!order || order.pdv_id !== session.pdv_id) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  if (
    !REFUNDABLE_STATUSES.includes(
      order.status as (typeof REFUNDABLE_STATUSES)[number]
    )
  ) {
    return NextResponse.json(
      { error: "Este pedido não está disponível para reembolso" },
      { status: 409 }
    );
  }

  const currentRefund = order.refund_status as RefundState | null;
  if (currentRefund === "done") {
    return NextResponse.json(
      { error: "Este pedido já foi reembolsado" },
      { status: 409 }
    );
  }
  if (currentRefund === "requested" || currentRefund === "pending") {
    return NextResponse.json(
      { error: "O reembolso deste pedido já está em processamento" },
      { status: 409 }
    );
  }
  if (currentRefund === "partial") {
    return NextResponse.json(
      {
        error:
          "Existe um reembolso parcial nesta cobrança. Conclua o ajuste diretamente no Asaas.",
      },
      { status: 409 }
    );
  }

  const isAsaasRefund = Boolean(order.asaas_payment_id);
  const refundMode = isAsaasRefund ? "asaas" : "manual";
  const requestedAt = new Date().toISOString();
  const reason =
    body.reason ||
    (isAsaasRefund
      ? `Reembolso integral do pedido #${order.number}`
      : `Reembolso manual do pedido #${order.number}`);

  // Claim condicional: impede dois operadores de solicitarem o mesmo estorno.
  const { data: claimed, error: claimError } = await supabase
    .from("orders")
    .update({
      refund_status: "requested",
      refund_mode: refundMode,
      refund_amount: Number(order.total),
      refund_reason: reason,
      refund_requested_at: requestedAt,
      refund_error: null,
    })
    .eq("id", order.id)
    .or(
      "refund_status.is.null,refund_status.eq.failed,refund_status.eq.cancelled"
    )
    .select("id")
    .maybeSingle();

  if (claimError) {
    return internalErrorResponse(
      "pdv-order-refund-claim",
      claimError,
      "Não foi possível iniciar o reembolso"
    );
  }
  if (!claimed) {
    return NextResponse.json(
      { error: "O reembolso deste pedido já foi solicitado" },
      { status: 409 }
    );
  }

  // Pagamentos feitos na tenda não passam pelo Asaas. O operador confirma que
  // devolveu o valor pela maquininha/Pix e o sistema registra a conciliação.
  if (!order.asaas_payment_id) {
    const refundedAt = new Date().toISOString();
    const { error } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        refund_status: "done",
        refunded_at: refundedAt,
      })
      .eq("id", order.id)
      .eq("refund_status", "requested");

    if (error) {
      return internalErrorResponse(
        "pdv-order-manual-refund",
        error,
        "Não foi possível registrar o reembolso"
      );
    }

    return NextResponse.json({
      ok: true,
      refund_status: "done",
      message: "Reembolso manual registrado com sucesso.",
    });
  }

  try {
    // Sem `value`: a API do Asaas solicita o reembolso integral.
    const payment = await refundPayment(order.asaas_payment_id, reason);
    const refunds = payment.refunds ?? [];
    const doneAmount = refunds
      .filter((refund) => refund.status === "DONE")
      .reduce((sum, refund) => sum + Number(refund.value || 0), 0);
    const done =
      payment.status === "REFUNDED" ||
      doneAmount >= Number(order.total) - 0.005;
    const refundStatus: RefundState = done ? "done" : "pending";
    const receipt = latestRefund(refunds, "DONE")?.transactionReceiptUrl;

    const { error } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        refund_status: refundStatus,
        refund_amount: Number(order.total),
        refunded_at: done ? new Date().toISOString() : null,
        refund_receipt_url: receipt || null,
        refund_error: null,
      })
      .eq("id", order.id)
      .eq("refund_status", "requested");

    if (error) {
      return internalErrorResponse(
        "pdv-order-refund-save",
        error,
        "O Asaas recebeu a solicitação, mas não foi possível atualizar o pedido"
      );
    }

    return NextResponse.json({
      ok: true,
      refund_status: refundStatus,
      receipt_url: receipt || null,
      message: done
        ? "Reembolso concluído pelo Asaas."
        : "Reembolso solicitado ao Asaas e aguardando confirmação.",
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido";
    await supabase
      .from("orders")
      .update({
        refund_status: "failed",
        refund_error: errorMessage,
      })
      .eq("id", order.id)
      .eq("refund_status", "requested");

    return upstreamErrorResponse(
      "pdv-order-refund-asaas",
      error,
      "O Asaas não aceitou o reembolso. Verifique o saldo e tente novamente."
    );
  }
}
