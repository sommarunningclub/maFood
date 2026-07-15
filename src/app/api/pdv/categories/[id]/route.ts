import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";
import { internalErrorResponse } from "@/lib/server-errors";

const PatchBody = z.object({
  name: z.string().min(1).max(60).optional(),
  sort_order: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
});

async function assertOwn(id: string, pdvId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("product_categories")
    .select("id, pdv_id, name")
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
  const { error } = await supabase
    .from("product_categories")
    .update(body)
    .eq("id", params.id);
  if (error) {
    return internalErrorResponse(
      "pdv-category-update",
      error,
      "Não foi possível atualizar a categoria"
    );
  }

  // Se renomeou, propaga o nome pros products.category text legacy
  if (body.name && body.name !== owned.name) {
    const { error: productsError } = await supabase
      .from("products")
      .update({ category: body.name })
      .eq("category_id", params.id);
    if (productsError) {
      return internalErrorResponse(
        "pdv-category-products",
        productsError,
        "A categoria foi atualizada, mas não foi possível atualizar os produtos"
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owned = await assertOwn(params.id, session.pdv_id);
  if (!owned) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = createAdminClient();
  // Mantém produtos sem categoria (FK ON DELETE SET NULL na coluna category_id)
  const { error } = await supabase
    .from("product_categories")
    .delete()
    .eq("id", params.id);
  if (error) {
    return internalErrorResponse(
      "pdv-category-delete",
      error,
      "Não foi possível excluir a categoria"
    );
  }
  return NextResponse.json({ ok: true });
}
