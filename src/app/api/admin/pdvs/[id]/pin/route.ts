import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin } from "@/lib/auth/pin";
import { getAdminSession } from "@/lib/auth/admin-session";
import { internalErrorResponse } from "@/lib/server-errors";

const Body = z.object({ pin: z.string().regex(/^\d{4,8}$/) });

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body;
  try { body = Body.parse(await req.json()); }
  catch { return NextResponse.json({ error: "PIN deve ter 4-8 digitos" }, { status: 400 }); }

  const supabase = createAdminClient();
  const hash = await hashPin(body.pin);
  const { error } = await supabase
    .from("pdvs")
    .update({ pin_hash: hash, pin_set_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) {
    return internalErrorResponse("admin-pdv-pin-set", error, "Não foi possível definir o PIN");
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pdvs")
    .update({ pin_hash: null, pin_set_at: null })
    .eq("id", params.id);
  if (error) {
    return internalErrorResponse("admin-pdv-pin-delete", error, "Não foi possível remover o PIN");
  }
  return NextResponse.json({ ok: true });
}
