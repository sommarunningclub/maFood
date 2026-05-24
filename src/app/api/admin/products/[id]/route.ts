import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const Patch = z.object({
  category_id: z.string().uuid().nullable().optional(),
  category: z.string().max(80).optional(),
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(400).optional(),
  price: z.coerce.number().min(0).max(99999).optional(),
  image_url: z.string().max(500).optional(),
  status: z.enum(["active", "paused", "out_of_stock"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body;
  try { body = Patch.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Sincroniza category texto se mudou category_id
  if (body.category_id !== undefined && body.category === undefined) {
    if (body.category_id) {
      const { data: cat } = await supabase
        .from("product_categories")
        .select("name")
        .eq("id", body.category_id)
        .maybeSingle();
      if (cat) (body as { category?: string }).category = cat.name;
    } else {
      (body as { category?: string }).category = "";
    }
  }

  const { error } = await supabase.from("products").update(body).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("products").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
