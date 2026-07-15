import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";
import { internalErrorResponse } from "@/lib/server-errors";

export async function GET() {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name, sort_order, is_active")
    .eq("pdv_id", session.pdv_id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    return internalErrorResponse(
      "pdv-categories-list",
      error,
      "Não foi possível carregar as categorias"
    );
  }
  return NextResponse.json({ categories: data ?? [] });
}

const Body = z.object({
  name: z.string().min(1).max(60),
  sort_order: z.coerce.number().int().optional(),
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
  const { data, error } = await supabase
    .from("product_categories")
    .insert({
      pdv_id: session.pdv_id,
      name: body.name.trim(),
      sort_order: body.sort_order ?? 0,
    })
    .select("id, name, sort_order, is_active")
    .single();

  if (error) {
    return internalErrorResponse(
      "pdv-category-create",
      error,
      "Não foi possível criar a categoria"
    );
  }
  return NextResponse.json({ ok: true, category: data });
}
