import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPin } from "@/lib/auth/pin";
import { signSession, setPdvSessionCookie } from "@/lib/auth/session";

const Body = z.object({
  slug: z.string().min(1).max(80),
  pin: z.string().regex(/^\d{4,8}$/, "PIN invalido"),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: pdv, error } = await supabase
    .from("pdvs")
    .select("id, slug, pin_hash")
    .eq("slug", body.slug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
  if (!pdv) {
    return NextResponse.json({ error: "PDV nao encontrado" }, { status: 404 });
  }
  if (!pdv.pin_hash) {
    return NextResponse.json(
      { error: "Este PDV ainda nao tem PIN. Solicite ao admin." },
      { status: 403 }
    );
  }

  const ok = await verifyPin(body.pin, pdv.pin_hash);
  if (!ok) {
    return NextResponse.json({ error: "PIN incorreto" }, { status: 401 });
  }

  const token = await signSession({ pdv_id: pdv.id, pdv_slug: pdv.slug });
  await setPdvSessionCookie(token);

  return NextResponse.json({ ok: true, pdv_slug: pdv.slug });
}
