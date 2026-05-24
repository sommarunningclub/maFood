import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { setAdminCookie, signAdmin } from "@/lib/auth/admin-session";

const Body = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supa = createAdminClient();
  const email = body.email.toLowerCase().trim();

  const { data: admin } = await supa
    .from("admins")
    .select("id, email, name, password_hash")
    .eq("email", email)
    .maybeSingle();

  // Mensagem genérica evita enumeração de e-mails
  if (!admin) {
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  const ok = await bcrypt.compare(body.password, admin.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  // Atualiza last_login_at (best-effort)
  await supa.from("admins").update({ last_login_at: new Date().toISOString() }).eq("id", admin.id);

  const token = await signAdmin({ admin_id: admin.id, email: admin.email, name: admin.name });
  await setAdminCookie(token);

  return NextResponse.json({ ok: true, admin: { id: admin.id, email: admin.email, name: admin.name } });
}
