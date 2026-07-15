/*
  Bootstrap do primeiro admin do backoffice.
  - Só aceita POST quando `mafood.admins` está vazia (auto-trava após o primeiro)
  - Cria com bcrypt e já assina a sessão (entra direto no /admin)
  - Endpoint público por desenho — segurança vem do fato de só funcionar 1x
*/
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { setAdminCookie, signAdmin } from "@/lib/auth/admin-session";
import { internalErrorResponse } from "@/lib/server-errors";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  name: z.string().min(2),
});

export async function GET() {
  // Lista pública minimalista: só revela se o setup ainda é necessário
  const supa = createAdminClient();
  const { count, error } = await supa
    .from("admins")
    .select("id", { count: "exact", head: true });
  if (error) {
    return internalErrorResponse(
      "admin-setup-status",
      error,
      "Não foi possível verificar o setup"
    );
  }
  return NextResponse.json({ needs_setup: (count ?? 0) === 0 });
}

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supa = createAdminClient();
  const { count, error: countError } = await supa
    .from("admins")
    .select("id", { count: "exact", head: true });
  if (countError) {
    return internalErrorResponse(
      "admin-setup-count",
      countError,
      "Não foi possível iniciar o setup"
    );
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Setup já realizado. Use /admin/login." },
      { status: 403 }
    );
  }

  const hash = await bcrypt.hash(body.password, 10);
  const { data: created, error } = await supa
    .from("admins")
    .insert({
      email: body.email.toLowerCase().trim(),
      password_hash: hash,
      name: body.name.trim(),
    })
    .select("id, email, name")
    .single();

  if (error || !created) {
    return internalErrorResponse(
      "admin-setup-create",
      error ?? new Error("admin insert returned no row"),
      "Não foi possível criar o administrador"
    );
  }

  const token = await signAdmin({
    admin_id: created.id,
    email: created.email,
    name: created.name,
  });
  await setAdminCookie(token);

  return NextResponse.json({ ok: true, admin: created });
}
