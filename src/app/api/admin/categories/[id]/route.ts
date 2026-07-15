import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { internalErrorResponse } from "@/lib/server-errors";

const Patch = z.object({
  name: z.string().min(1).max(80).optional(),
  sort_order: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body;
  try { body = Patch.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Se renomeou, atualizar também products.category texto (para PDVs que usam string)
  if (body.name) {
    const { data: cat } = await supabase
      .from("product_categories")
      .select("pdv_id, name")
      .eq("id", params.id)
      .maybeSingle();
    if (cat && cat.name !== body.name) {
      const { error: productsError } = await supabase
        .from("products")
        .update({ category: body.name })
        .eq("pdv_id", cat.pdv_id)
        .eq("category_id", params.id);
      if (productsError) {
        return internalErrorResponse(
          "admin-category-products",
          productsError,
          "Não foi possível atualizar os produtos da categoria"
        );
      }
    }
  }

  const { error } = await supabase.from("product_categories").update(body).eq("id", params.id);
  if (error) {
    return internalErrorResponse(
      "admin-category-update",
      error,
      "Não foi possível atualizar a categoria"
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  // products que referenciam vão ficar com category_id = null (on delete set null)
  const { error } = await supabase.from("product_categories").delete().eq("id", params.id);
  if (error) {
    return internalErrorResponse(
      "admin-category-delete",
      error,
      "Não foi possível excluir a categoria"
    );
  }
  return NextResponse.json({ ok: true });
}
