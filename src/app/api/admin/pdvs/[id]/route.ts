import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const Body = z.object({
  name: z.string().min(1).max(120).optional(),
  category: z.string().max(80).optional(),
  logo_url: z.string().max(500).optional(),
  prep_time_min: z.coerce.number().int().min(1).max(180).optional(),
  commission_pct: z.coerce.number().min(0).max(50).optional(),
  gateway_pct: z.coerce.number().min(0).max(20).optional(),
  instagram_handle: z.string().max(60).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  is_open: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("pdvs").update(body).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("pdvs").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
