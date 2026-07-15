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
  is_visible: z.boolean().optional(),
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

  // Trava de segurança: só permite apagar PDV "limpo". PDV com pedidos no
  // histórico ou saldo em carteira NÃO pode ser apagado (o delete cascatearia
  // pedidos/pagamentos e destruiria registro financeiro). Bloqueia com 409.
  const { data: pdv, error: eFetch } = await supabase
    .from("pdvs")
    .select("id, name, wallet_balance")
    .eq("id", params.id)
    .maybeSingle();
  if (eFetch) return NextResponse.json({ error: eFetch.message }, { status: 500 });
  if (!pdv) return NextResponse.json({ error: "PDV não encontrado" }, { status: 404 });

  const { count: orderCount, error: eCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("pdv_id", params.id);
  if (eCount) return NextResponse.json({ error: eCount.message }, { status: 500 });

  if ((orderCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `Este PDV tem ${orderCount} pedido(s) no histórico e não pode ser apagado. Desative-o (Fechado) em vez de excluir.`,
      },
      { status: 409 }
    );
  }
  if (Number(pdv.wallet_balance ?? 0) !== 0) {
    return NextResponse.json(
      {
        error: "Este PDV tem saldo em carteira e não pode ser apagado. Zere a carteira antes de excluir.",
      },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("pdvs").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
