import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerSession } from "@/lib/auth/customer-session";

const Body = z.object({
  pdv_id: z.string().uuid(),
  method: z.enum(["pix", "card"]),
  notes: z.string().max(500).optional().nullable(),
  coupon_code: z.string().max(60).optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        qty: z.coerce.number().int().min(1).max(99),
        notes: z.string().max(200).optional().nullable(),
      })
    )
    .min(1),
});

export async function POST(req: Request) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body;
  try { body = Body.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Busca PDV (precisa de venue_id) e produtos (preço autoritativo do banco)
  const { data: pdv, error: ePdv } = await supabase
    .from("pdvs")
    .select("id, venue_id, is_open")
    .eq("id", body.pdv_id)
    .maybeSingle();
  if (ePdv || !pdv) return NextResponse.json({ error: "PDV invalido" }, { status: 400 });
  if (!pdv.is_open) return NextResponse.json({ error: "PDV fechado" }, { status: 400 });

  const productIds = body.items.map((i) => i.product_id);
  const { data: products, error: ePr } = await supabase
    .from("products")
    .select("id, pdv_id, name, price, status")
    .in("id", productIds);
  if (ePr) return NextResponse.json({ error: ePr.message }, { status: 500 });

  // Validações por item
  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  for (const it of body.items) {
    const p = byId.get(it.product_id);
    if (!p) return NextResponse.json({ error: "Produto invalido" }, { status: 400 });
    if (p.pdv_id !== pdv.id)
      return NextResponse.json({ error: "Produto nao pertence ao PDV" }, { status: 400 });
    if (p.status !== "active")
      return NextResponse.json({ error: `Produto indisponivel: ${p.name}` }, { status: 400 });
  }

  // Cupom (opcional)
  let couponId: string | null = null;
  let discount = 0;
  let subtotal = body.items.reduce((s, it) => {
    const p = byId.get(it.product_id)!;
    return s + Number(p.price) * it.qty;
  }, 0);

  if (body.coupon_code) {
    const code = body.coupon_code.trim().toUpperCase();
    const { data: coupon } = await supabase
      .from("coupons")
      .select("id, type, value, min_order, max_uses, used, is_active, valid_until")
      .eq("code", code)
      .maybeSingle();
    if (coupon && coupon.is_active && (coupon.max_uses === 0 || coupon.used < coupon.max_uses)) {
      const exp = coupon.valid_until ? new Date(coupon.valid_until) : null;
      const ok = !exp || exp >= new Date();
      const min = Number(coupon.min_order);
      if (ok && subtotal >= min) {
        couponId = coupon.id;
        discount =
          coupon.type === "percent"
            ? (subtotal * Number(coupon.value)) / 100
            : Number(coupon.value);
      }
    }
  }

  const total = Math.max(0, subtotal - discount);

  // Cria pedido com status "paid" (simulado: pagamento fingido)
  // Em produção: status="pending" + criar cobrança Asaas + webhook muda pra "paid"
  const fakePixPayload = `00020126BR.GOV.BCB.PIX maFood ${total.toFixed(2)} ${Date.now()}`;

  const { data: order, error: eOrder } = await supabase
    .from("orders")
    .insert({
      venue_id: pdv.venue_id,
      pdv_id: pdv.id,
      customer_id: session.customer_id,
      customer_name: session.name,
      customer_cpf: session.cpf,
      total,
      method: body.method,
      status: "paid", // simulado
      paid_at: new Date().toISOString(),
      notes: body.notes ?? null,
      coupon_id: couponId,
      pix_payload: body.method === "pix" ? fakePixPayload : null,
    })
    .select("id, number")
    .single();

  if (eOrder || !order) {
    return NextResponse.json({ error: eOrder?.message ?? "Erro ao criar pedido" }, { status: 500 });
  }

  // Cria items
  const itemsToInsert = body.items.map((it) => {
    const p = byId.get(it.product_id)!;
    return {
      order_id: order.id,
      product_id: p.id,
      name: p.name,
      qty: it.qty,
      unit_price: Number(p.price),
      notes: it.notes ?? null,
    };
  });

  const { error: eItems } = await supabase.from("order_items").insert(itemsToInsert);
  if (eItems) {
    // rollback: apaga pedido
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: eItems.message }, { status: 500 });
  }

  // Incrementa "used" do cupom (best-effort)
  if (couponId) {
    const { data: cur } = await supabase
      .from("coupons")
      .select("used")
      .eq("id", couponId)
      .maybeSingle();
    if (cur) {
      await supabase.from("coupons").update({ used: cur.used + 1 }).eq("id", couponId);
    }
  }

  return NextResponse.json({
    ok: true,
    order_id: order.id,
    order_number: order.number,
    total,
    discount,
    pix_payload: fakePixPayload,
  });
}
