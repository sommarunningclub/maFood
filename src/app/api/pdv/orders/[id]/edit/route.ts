/*
  Edita items + notas de um pedido existente do PDV.

  Comportamento:
  - Items: replace-all (envia lista completa do estado novo).
  - Preço por item: re-busca do products.price atual (autoritativo do banco).
  - Items com delivered_qty > 0 NÃO podem ser removidos (impede perder
    histórico de entregas parciais).
  - Total do pedido é recalculado.
  - O valor cobrado no Asaas NÃO é alterado — o operador é responsável
    por estornar/cobrar diferença manualmente. A UI deve avisar quando
    status != pending.
*/
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";
import { effectivePrice } from "@/lib/pricing";

const Body = z.object({
  notes: z.string().max(500).nullable().optional(),
  items: z
    .array(
      z.object({
        // id presente = item já existe (preserva delivered_qty); ausente = novo
        id: z.string().uuid().optional(),
        product_id: z.string().uuid(),
        qty: z.coerce.number().int().min(1).max(99),
        item_notes: z.string().max(200).nullable().optional(),
      })
    )
    .min(1),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, pdv_id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!order || order.pdv_id !== session.pdv_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Items existentes pra checar delivered_qty e preservar IDs
  const { data: existingItems } = await supabase
    .from("order_items")
    .select("id, product_id, delivered_qty")
    .eq("order_id", params.id);
  const existingById = new Map((existingItems ?? []).map((i) => [i.id, i]));

  // Validação: items mantidos não podem ter qty < delivered_qty
  for (const it of body.items) {
    if (it.id) {
      const ex = existingById.get(it.id);
      if (ex && it.qty < ex.delivered_qty) {
        return NextResponse.json(
          { error: `Quantidade não pode ser menor que entregue (${ex.delivered_qty})` },
          { status: 400 }
        );
      }
    }
  }

  // Items removidos: os existingItems cujo id não aparece no body
  const keptIds = new Set(body.items.filter((i) => i.id).map((i) => i.id!));
  const toRemove = (existingItems ?? []).filter((i) => !keptIds.has(i.id));
  for (const r of toRemove) {
    if (r.delivered_qty > 0) {
      return NextResponse.json(
        { error: "Não pode remover item já entregue parcialmente" },
        { status: 400 }
      );
    }
  }

  // Re-busca preços autoritativos
  const productIds = Array.from(new Set(body.items.map((i) => i.product_id)));
  const { data: products } = await supabase
    .from("products")
    .select("id, pdv_id, name, price, sale_price, status")
    .in("id", productIds);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  for (const it of body.items) {
    const p = productById.get(it.product_id);
    if (!p) return NextResponse.json({ error: "Produto inválido" }, { status: 400 });
    if (p.pdv_id !== session.pdv_id) {
      return NextResponse.json({ error: "Produto de outro PDV" }, { status: 400 });
    }
  }

  // Recalcula total
  const newTotal = body.items.reduce((s, it) => {
    const p = productById.get(it.product_id)!;
    return s + effectivePrice(p) * it.qty;
  }, 0);

  // Aplica: remove os fora, atualiza/insere os do body
  if (toRemove.length) {
    await supabase
      .from("order_items")
      .delete()
      .in(
        "id",
        toRemove.map((r) => r.id)
      );
  }

  for (const it of body.items) {
    const p = productById.get(it.product_id)!;
    if (it.id) {
      await supabase
        .from("order_items")
        .update({
          product_id: it.product_id,
          name: p.name,
          qty: it.qty,
          unit_price: effectivePrice(p),
          notes: it.item_notes ?? null,
        })
        .eq("id", it.id);
    } else {
      await supabase.from("order_items").insert({
        order_id: params.id,
        product_id: it.product_id,
        name: p.name,
        qty: it.qty,
        unit_price: effectivePrice(p),
        notes: it.item_notes ?? null,
      });
    }
  }

  // Atualiza order (total + notes)
  const orderPatch: Record<string, unknown> = { total: newTotal };
  if (body.notes !== undefined) orderPatch.notes = body.notes;
  const { error: eOrder } = await supabase
    .from("orders")
    .update(orderPatch)
    .eq("id", params.id);
  if (eOrder) return NextResponse.json({ error: eOrder.message }, { status: 500 });

  return NextResponse.json({ ok: true, total: newTotal });
}
