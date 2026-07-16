/*
  Login da landing raiz `/`:
  - recebe CPF
  - cliente já cadastrado entra normalmente
  - consulta as bases Somma para manter a condição VIP atualizada
  - qualquer pessoa ainda sem customer recebe URL para completar o cadastro
*/
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { attachCustomerCookie, signCustomer } from "@/lib/auth/customer-session";
import { internalErrorResponse } from "@/lib/server-errors";
import { lookupCustomerDirectory } from "@/lib/customer-directory";

const Body = z.object({
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
});

// CPF aparece em `dados_insiders` com pontuação (ex.: "067.478.051-51").
// Comparamos por dígitos puros via SQL para tolerar qualquer formato armazenado.
function digits(s: string) {
  return s.replace(/\D/g, "");
}

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const cpf = digits(body.cpf);

  // Consulta o cadastro maFood e todas as bases Somma em paralelo.
  const supa = createAdminClient();

  const [customerResult, directory] = await Promise.all([
    supa
      .from("customers")
      .select("id, name, is_vip")
      .eq("cpf", cpf)
      .maybeSingle(),
    lookupCustomerDirectory(cpf),
  ]);

  if (customerResult.error) {
    return internalErrorResponse(
      "landing-login-customer",
      customerResult.error,
      "Não foi possível consultar o cadastro"
    );
  }
  const existing = customerResult.data;
  if (!existing) {
    const params = new URLSearchParams({
      cpf,
      next: "/somma-special-day",
    });
    return NextResponse.json({
      status: "new",
      registerUrl: `/somma-special-day/login?${params.toString()}`,
    });
  }

  const isVip = Boolean(existing.is_vip || directory.isVip);
  if (isVip && !existing.is_vip) {
    const { error: updateError } = await supa
      .from("customers")
      .update({
        is_vip: true,
        lista_vip_id: directory.prefill.lista_vip_id || null,
      })
      .eq("id", existing.id);
    if (updateError) {
      return internalErrorResponse(
        "landing-login-customer-update",
        updateError,
        "Não foi possível concluir o acesso"
      );
    }
  }

  // Assina cookie de sessão de cliente (30 dias).
  const token = await signCustomer({
    customer_id: existing.id,
    cpf,
    name: existing.name,
    is_vip: isVip,
  });
  const res = NextResponse.json({
    ok: true,
    customer: { id: existing.id, name: existing.name },
    next: "/somma-special-day",
  });
  return attachCustomerCookie(res, token);
}
