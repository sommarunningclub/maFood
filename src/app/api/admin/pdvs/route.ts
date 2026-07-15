import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { internalErrorResponse } from "@/lib/server-errors";

const Body = z.object({
  venue_id: z.string().uuid(),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "use kebab-case (a-z, 0-9, -)"),
  name: z.string().min(1).max(120),
  category: z.string().max(80).optional().default(""),
  logo_url: z.string().max(500).optional().default("🍽"), // emoji ou URL de imagem
  prep_time_min: z.coerce.number().int().min(1).max(180).default(10),
  commission_pct: z.coerce.number().min(0).max(50).default(15),
  gateway_pct: z.coerce.number().min(0).max(20).default(3.6),
  instagram_handle: z.string().max(60).optional().nullable(),
  email: z.string().email().optional().nullable(),
});

export async function POST(req: Request) {
  let body;
  try { body = Body.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  // sort_order: ultimo + 1
  const { data: maxRow } = await supabase
    .from("pdvs")
    .select("sort_order")
    .eq("venue_id", body.venue_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("pdvs")
    .insert({ ...body, sort_order, is_open: true })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Slug ja existe neste venue" }, { status: 409 });
    }
    return internalErrorResponse("admin-pdv-create", error, "Não foi possível criar o PDV");
  }
  return NextResponse.json({ ok: true, id: data.id });
}
