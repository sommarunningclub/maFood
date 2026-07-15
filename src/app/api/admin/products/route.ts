import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { internalErrorResponse } from "@/lib/server-errors";

const ProductInput = z.object({
  pdv_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  category: z.string().max(80).optional().default(""),
  name: z.string().min(1).max(160),
  description: z.string().max(400).optional().default(""),
  price: z.coerce.number().min(0).max(99999),
  image_url: z.string().max(500).optional().default(""),
  status: z.enum(["active", "paused", "out_of_stock"]).optional().default("active"),
  stock_quantity: z.coerce.number().int().min(0).max(999999).nullable().optional(),
  supplier_cost: z.coerce.number().min(0).max(99999).nullable().optional(),
  sale_price: z.coerce.number().min(0).max(99999).nullable().optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pdvId = searchParams.get("pdv_id");

  const supabase = createAdminClient();
  let query = supabase
    .from("products")
    .select(
      "id, pdv_id, category_id, category, name, description, price, sale_price, image_url, status, stock_quantity, supplier_cost, created_at"
    )
    .order("created_at", { ascending: false });
  if (pdvId) query = query.eq("pdv_id", pdvId);

  const { data, error } = await query;
  if (error) {
    return internalErrorResponse(
      "admin-products-list",
      error,
      "Não foi possível carregar os produtos"
    );
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  let body;
  try {
    body = ProductInput.parse(await req.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Se enviou category_id mas não category (texto), preenche o texto pela categoria
  let categoryText = body.category;
  if (body.category_id && !categoryText) {
    const { data: cat } = await supabase
      .from("product_categories")
      .select("name")
      .eq("id", body.category_id)
      .maybeSingle();
    if (cat) categoryText = cat.name;
  }

  const { data, error } = await supabase
    .from("products")
    .insert({ ...body, category: categoryText })
    .select("id")
    .single();
  if (error) {
    return internalErrorResponse(
      "admin-product-create",
      error,
      "Não foi possível criar o produto"
    );
  }
  return NextResponse.json({ ok: true, id: data.id });
}
