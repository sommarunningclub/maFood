import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";

// Aceita qualquer status (exceto pending — esse fica trancado, só webhook libera)
// pra permitir DnD livre entre colunas no Kanban (incluindo voltar pra paid).
const Body = z.object({
  status: z.enum(["paid", "preparing", "ready", "partial", "delivered", "cancelled"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body;
  try { body = Body.parse(await req.json()); }
  catch { return NextResponse.json({ error: "Dados invalidos" }, { status: 400 }); }

  const supabase = createAdminClient();

  // Verifica que o pedido pertence ao PDV autenticado
  const { data: existing } = await supabase
    .from("orders")
    .select("id, pdv_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing || existing.pdv_id !== session.pdv_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = { ...body };
  if (body.status === "ready") patch.ready_at = new Date().toISOString();

  const { error } = await supabase.from("orders").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
