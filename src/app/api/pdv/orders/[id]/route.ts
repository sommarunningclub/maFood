import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";
import { decrementStockForOrder } from "@/lib/stock";
import { internalErrorResponse } from "@/lib/server-errors";

// Aceita qualquer status operacional (pending → paid via confirmação no balcão;
// Asaas também move pending → paid por webhook).
const Body = z.object({
  status: z.enum(["paid", "preparing", "ready", "partial", "delivered", "cancelled"]).optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const supabase = createAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("pdv_id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (error) {
    return internalErrorResponse(
      "pdv-order-status",
      error,
      "Não foi possível consultar o pedido"
    );
  }
  if (!order || order.pdv_id !== session.pdv_id) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ status: order.status });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  let body;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("orders")
    .select("id, pdv_id, status, method")
    .eq("id", params.id)
    .maybeSingle();
  if (existingError) {
    return internalErrorResponse(
      "pdv-order-read",
      existingError,
      "Não foi possível consultar o pedido"
    );
  }
  if (!existing || existing.pdv_id !== session.pdv_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = { ...body };
  if (body.status === "ready") patch.ready_at = new Date().toISOString();

  const confirmingPayment =
    body.status === "paid" && existing.status === "pending";

  if (confirmingPayment) {
    patch.paid_at = new Date().toISOString();
  }

  const { error } = await supabase.from("orders").update(patch).eq("id", params.id);
  if (error) {
    return internalErrorResponse(
      "pdv-order-update",
      error,
      "Não foi possível atualizar o pedido"
    );
  }

  if (confirmingPayment) {
    await decrementStockForOrder(supabase, params.id);
  }

  return NextResponse.json({ ok: true });
}
