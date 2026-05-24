import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";

const Body = z.object({
  // array: { item_id, qty } onde qty é o quanto está entregando AGORA (vai somar ao delivered_qty atual)
  deliveries: z
    .array(z.object({ item_id: z.string().uuid(), qty: z.coerce.number().int().min(0) }))
    .min(1),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body;
  try { body = Body.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Confirma propriedade
  const { data: order } = await supabase
    .from("orders")
    .select("id, pdv_id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!order || order.pdv_id !== session.pdv_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Busca items atuais
  const { data: items, error: e1 } = await supabase
    .from("order_items")
    .select("id, order_id, qty, delivered_qty")
    .eq("order_id", params.id);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  const byId = new Map((items ?? []).map((i) => [i.id, i]));
  for (const d of body.deliveries) {
    const it = byId.get(d.item_id);
    if (!it) return NextResponse.json({ error: "Item invalido" }, { status: 400 });
    const newDelivered = it.delivered_qty + d.qty;
    if (newDelivered > it.qty)
      return NextResponse.json({ error: `Quantidade > pedido (${it.qty})` }, { status: 400 });
    if (d.qty === 0) continue;
    const { error: eUp } = await supabase
      .from("order_items")
      .update({ delivered_qty: newDelivered })
      .eq("id", it.id);
    if (eUp) return NextResponse.json({ error: eUp.message }, { status: 500 });
    it.delivered_qty = newDelivered;
  }

  // Recalcula status do pedido: parcial vs delivered
  const allDelivered = (items ?? []).every((i) => i.delivered_qty >= i.qty);
  const anyDelivered = (items ?? []).some((i) => i.delivered_qty > 0);

  let newStatus: string | null = null;
  if (allDelivered) newStatus = "delivered";
  else if (anyDelivered && order.status !== "partial") newStatus = "partial";

  if (newStatus) {
    await supabase.from("orders").update({ status: newStatus }).eq("id", params.id);
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
