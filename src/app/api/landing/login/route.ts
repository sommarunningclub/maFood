/*
  Login da landing raiz `/`:
  - recebe CPF
  - cliente já cadastrado entra normalmente
  - insider ainda sem customer é criado como VIP
  - CPF desconhecido recebe URL para criar um cadastro
*/
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, createAdminClientPublic } from "@/lib/supabase/admin";
import { attachCustomerCookie, signCustomer } from "@/lib/auth/customer-session";
import { internalErrorResponse } from "@/lib/server-errors";

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

  // Consulta cadastro geral e lista de insiders em paralelo.
  const supa = createAdminClient();
  const supaPub = createAdminClientPublic();
  const masked = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;

  const [customerResult, insiderResult] = await Promise.all([
    supa
      .from("customers")
      .select("id, name, is_vip")
      .eq("cpf", cpf)
      .maybeSingle(),
    supaPub
      .from("dados_insiders")
      .select("id, nome, cpf")
      .or(`cpf.eq.${cpf},cpf.eq.${masked}`)
      .limit(1)
      .maybeSingle(),
  ]);

  if (customerResult.error) {
    return internalErrorResponse(
      "landing-login-customer",
      customerResult.error,
      "Não foi possível consultar o cadastro"
    );
  }
  if (insiderResult.error) {
    return internalErrorResponse(
      "landing-login-insider",
      insiderResult.error,
      "Não foi possível validar o CPF"
    );
  }

  const existing = customerResult.data;
  const insider = insiderResult.data;

  if (!existing && !insider) {
    const params = new URLSearchParams({
      cpf,
      next: "/somma-special-day",
    });
    return NextResponse.json({
      status: "new",
      registerUrl: `/somma-special-day/login?${params.toString()}`,
    });
  }

  // Reaproveita customer existente ou cria o insider como customer VIP.
  let customerId = existing?.id;
  let customerName = existing?.name ?? insider?.nome?.trim() ?? "Cliente";
  const isVip = Boolean(existing?.is_vip || insider);

  if (!customerId && insider) {
    const { data: created, error: eCreate } = await supa
      .from("customers")
      .insert({
        cpf,
        name: customerName,
        is_vip: isVip,
      })
      .select("id, name")
      .single();
    if (eCreate || !created) {
      return internalErrorResponse(
        "landing-login-customer-create",
        eCreate ?? new Error("customer insert returned no row"),
        "Não foi possível concluir o acesso"
      );
    }
    customerId = created.id;
    customerName = created.name;
  } else if (customerId && insider && !existing?.is_vip) {
    // Se também consta na lista de insiders, promove o cadastro existente.
    const { error: updateError } = await supa
      .from("customers")
      .update({ is_vip: isVip })
      .eq("id", customerId);
    if (updateError) {
      return internalErrorResponse(
        "landing-login-customer-update",
        updateError,
        "Não foi possível concluir o acesso"
      );
    }
  }

  if (!customerId) {
    return NextResponse.json({ error: "Não foi possível concluir o cadastro" }, { status: 500 });
  }

  // Assina cookie de sessão de cliente (30 dias).
  const token = await signCustomer({
    customer_id: customerId,
    cpf,
    name: customerName,
    is_vip: isVip,
  });
  const res = NextResponse.json({
    ok: true,
    customer: { id: customerId, name: customerName },
    next: "/somma-special-day",
  });
  return attachCustomerCookie(res, token);
}
