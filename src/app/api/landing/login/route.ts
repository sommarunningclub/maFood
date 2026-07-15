/*
  Login da landing raiz `/`:
  - recebe CPF
  - busca em `public.dados_insiders` (lista de "insiders" do Somma Special Day)
  - se encontrar, upsert em `mafood.customers` (chave: cpf) e assina cookie
  - retorna `next` pra redirecionar ao marketplace
*/
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, createAdminClientPublic } from "@/lib/supabase/admin";
import { setCustomerCookie, signCustomer } from "@/lib/auth/customer-session";
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

  // 1. Procura no insider list (public schema). A coluna `cpf` é text e pode
  //    conter pontuação — tentamos sem pontuação primeiro, depois com.
  const supaPub = createAdminClientPublic();
  const masked = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;

  const { data: insider, error: eInsider } = await supaPub
    .from("dados_insiders")
    .select("id, nome, cpf")
    .or(`cpf.eq.${cpf},cpf.eq.${masked}`)
    .limit(1)
    .maybeSingle();

  if (eInsider) {
    return internalErrorResponse(
      "landing-login-insider",
      eInsider,
      "Não foi possível validar o CPF"
    );
  }
  if (!insider) {
    return NextResponse.json(
      { error: "CPF não encontrado na lista de insiders." },
      { status: 404 }
    );
  }

  // 2. Upsert no `mafood.customers` (cpf é UNIQUE). Reaproveita registro
  //    se cliente já existia (caso tenha entrado antes pelo /<venue>/login).
  const supa = createAdminClient();
  const { data: existing, error: existingError } = await supa
    .from("customers")
    .select("id, name, is_vip")
    .eq("cpf", cpf)
    .maybeSingle();
  if (existingError) {
    return internalErrorResponse(
      "landing-login-customer",
      existingError,
      "Não foi possível concluir o acesso"
    );
  }

  let customerId = existing?.id;
  let customerName = existing?.name ?? insider.nome;
  const isVip = true; // insiders são tratados como VIP

  if (!customerId) {
    const { data: created, error: eCreate } = await supa
      .from("customers")
      .insert({
        cpf,
        name: insider.nome,
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
  } else if (!existing?.is_vip) {
    // Promove a VIP se ainda não é
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

  // 3. Assina cookie de sessão de cliente (30 dias)
  const token = await signCustomer({
    customer_id: customerId,
    cpf,
    name: customerName,
    is_vip: isVip,
  });
  await setCustomerCookie(token);

  return NextResponse.json({
    ok: true,
    customer: { id: customerId, name: customerName },
    next: "/somma-special-day",
  });
}
