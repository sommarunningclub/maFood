import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";

const Item = z.object({
  product_id: z.string().uuid(),
  qty: z.coerce.number().int().min(1).max(99),
});

const PatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  price: z.coerce.number().min(0).max(99999).optional(),
  image_url: z.string().url().nullable().optional(),
  status: z.enum(["active", "paused", "out_of_stock"]).optional(),
  items: z.array(Item).min(1).optional(),
});

async function assertOwn(id: string, pdvId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("combos")
    .select("id, pdv_id")
    .eq("id", id)
    .maybeSingle();
  return data && data.pdv_id === pdvId ? data : null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owned = await assertOwn(params.id, session.pdv_id);
  if (!owned) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: z.infer<typeof PatchBody>;
  try { body = PatchBody.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.description !== undefined) patch.description = body.description ?? "";
  if (body.price !== undefined) patch.price = body.price;
  if (body.image_url !== undefined) patch.image_url = body.image_url ?? "";
  if (body.status !== undefined) patch.status = body.status;

  if (Object.keys(patch).length) {
    const { error } = await supabase.from("combos").update(patch).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Reescreve itens se vieram (replace all)
  if (body.items) {
    const ids = body.items.map((i) => i.product_id);
    const { data: prods } = await supabase
      .from("products")
      .select("id, pdv_id")
      .in("id", ids);
    if (!prods || prods.some((p) => p.pdv_id !== session.pdv_id)) {
      return NextResponse.json({ error: "Produto inválido" }, { status: 400 });
    }
    await supabase.from("combo_items").delete().eq("combo_id", params.id);
    const { error: eItems } = await supabase.from("combo_items").insert(
      body.items.map((it, idx) => ({
        combo_id: params.id,
        product_id: it.product_id,
        qty: it.qty,
        sort_order: idx,
      }))
    );
    if (eItems) return NextResponse.json({ error: eItems.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owned = await assertOwn(params.id, session.pdv_id);
  if (!owned) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("combos").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
