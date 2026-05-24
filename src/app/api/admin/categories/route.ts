import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const CategoryInput = z.object({
  pdv_id: z.string().uuid(),
  name: z.string().min(1).max(80),
  sort_order: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pdvId = searchParams.get("pdv_id");
  if (!pdvId) return NextResponse.json({ error: "pdv_id obrigatorio" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, pdv_id, name, sort_order, is_active")
    .eq("pdv_id", pdvId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  let body;
  try { body = CategoryInput.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  // sort_order = último + 1 se não informado
  if (body.sort_order == null) {
    const { data: maxRow } = await supabase
      .from("product_categories")
      .select("sort_order")
      .eq("pdv_id", body.pdv_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    body.sort_order = (maxRow?.sort_order ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from("product_categories")
    .insert(body)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
