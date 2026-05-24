/*
  Produtos do PDV autenticado — listagem (GET) e cadastro (POST).
  Edição/exclusão estão em /api/pdv/products/[id].
*/
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, price, image_url, category, category_id, status, created_at")
    .eq("pdv_id", session.pdv_id)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

const CreateBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  price: z.coerce.number().min(0).max(99999),
  image_url: z.string().url().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  status: z.enum(["active", "paused", "out_of_stock"]).default("active"),
});

export async function POST(req: Request) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof CreateBody>;
  try { body = CreateBody.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Resolve nome da categoria (coluna legacy text) a partir do id
  let categoryName: string | null = null;
  if (body.category_id) {
    const { data: cat } = await supabase
      .from("product_categories")
      .select("name, pdv_id")
      .eq("id", body.category_id)
      .maybeSingle();
    if (!cat || cat.pdv_id !== session.pdv_id) {
      return NextResponse.json({ error: "Categoria invalida" }, { status: 400 });
    }
    categoryName = cat.name;
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      pdv_id: session.pdv_id,
      name: body.name.trim(),
      description: body.description ?? null,
      price: body.price,
      image_url: body.image_url ?? null,
      category: categoryName,
      category_id: body.category_id ?? null,
      status: body.status,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
