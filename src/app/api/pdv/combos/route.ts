import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: combos, error } = await supabase
    .from("combos")
    .select("id, type, name, description, image_url, price, status, sort_order, created_at")
    .eq("pdv_id", session.pdv_id)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (combos ?? []).map((c) => c.id);
  let items: { combo_id: string; product_id: string; qty: number; name: string; price: number }[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("combo_items")
      .select("combo_id, product_id, qty, products(name, price)")
      .in("combo_id", ids);
    items =
      data?.map((r) => ({
        combo_id: r.combo_id,
        product_id: r.product_id,
        qty: r.qty,
        // @ts-expect-error supabase nested select type
        name: r.products?.name ?? "",
        // @ts-expect-error supabase nested select type
        price: Number(r.products?.price ?? 0),
      })) ?? [];
  }

  return NextResponse.json({ combos: combos ?? [], items });
}

const Item = z.object({
  product_id: z.string().uuid(),
  qty: z.coerce.number().int().min(1).max(99),
});

const Body = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  price: z.coerce.number().min(0).max(99999),
  image_url: z.string().url().optional().nullable(),
  status: z.enum(["active", "paused", "out_of_stock"]).default("active"),
  items: z.array(Item).min(1),
});

export async function POST(req: Request) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Valida que todos os produtos pertencem ao PDV
  const ids = body.items.map((i) => i.product_id);
  const { data: prods } = await supabase
    .from("products")
    .select("id, pdv_id")
    .in("id", ids);
  if (!prods || prods.some((p) => p.pdv_id !== session.pdv_id)) {
    return NextResponse.json({ error: "Produto inválido" }, { status: 400 });
  }

  const { data: combo, error } = await supabase
    .from("combos")
    .insert({
      pdv_id: session.pdv_id,
      type: "fixed",
      name: body.name.trim(),
      description: body.description ?? "",
      image_url: body.image_url ?? "",
      price: body.price,
      status: body.status,
    })
    .select("id")
    .single();
  if (error || !combo) return NextResponse.json({ error: error?.message ?? "Erro" }, { status: 500 });

  const { error: eItems } = await supabase.from("combo_items").insert(
    body.items.map((it, idx) => ({
      combo_id: combo.id,
      product_id: it.product_id,
      qty: it.qty,
      sort_order: idx,
    }))
  );
  if (eItems) {
    await supabase.from("combos").delete().eq("id", combo.id);
    return NextResponse.json({ error: eItems.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: combo.id });
}
