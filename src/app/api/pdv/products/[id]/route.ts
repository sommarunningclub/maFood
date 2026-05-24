import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";

const PatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  price: z.coerce.number().min(0).max(99999).optional(),
  image_url: z.string().url().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  status: z.enum(["active", "paused", "out_of_stock"]).optional(),
});

async function assertOwnership(productId: string, pdvId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("products")
    .select("id, pdv_id")
    .eq("id", productId)
    .maybeSingle();
  if (!data || data.pdv_id !== pdvId) return null;
  return data;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const owned = await assertOwnership(params.id, session.pdv_id);
  if (!owned) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: z.infer<typeof PatchBody>;
  try { body = PatchBody.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();
  const patch: Record<string, unknown> = { ...body };

  // Se category_id mudou, atualiza o campo text legacy também
  if ("category_id" in body) {
    if (body.category_id) {
      const { data: cat } = await supabase
        .from("product_categories")
        .select("name, pdv_id")
        .eq("id", body.category_id)
        .maybeSingle();
      if (!cat || cat.pdv_id !== session.pdv_id) {
        return NextResponse.json({ error: "Categoria invalida" }, { status: 400 });
      }
      patch.category = cat.name;
    } else {
      patch.category = null;
    }
  }

  const { error } = await supabase.from("products").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const owned = await assertOwnership(params.id, session.pdv_id);
  if (!owned) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("products").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
