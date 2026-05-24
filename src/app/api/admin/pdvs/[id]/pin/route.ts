import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin } from "@/lib/auth/pin";

const Body = z.object({ pin: z.string().regex(/^\d{4,8}$/) });

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  // TODO(auth admin): por ora confia que /admin é restrito.
  // Quando ligarmos Supabase Auth p/ admin, validar role 'superadmin' aqui.
  let body;
  try { body = Body.parse(await req.json()); }
  catch { return NextResponse.json({ error: "PIN deve ter 4-8 digitos" }, { status: 400 }); }

  const supabase = createAdminClient();
  const hash = await hashPin(body.pin);
  const { error } = await supabase
    .from("pdvs")
    .update({ pin_hash: hash, pin_set_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pdvs")
    .update({ pin_hash: null, pin_set_at: null })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
