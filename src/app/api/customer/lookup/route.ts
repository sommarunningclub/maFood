import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, createAdminClientPublic } from "@/lib/supabase/admin";
import { signCustomer, setCustomerCookie } from "@/lib/auth/customer-session";
import { internalErrorResponse } from "@/lib/server-errors";

const Body = z.object({ cpf: z.string().min(11).max(14) });

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

export async function POST(req: Request) {
  let body;
  try { body = Body.parse(await req.json()); }
  catch { return NextResponse.json({ error: "CPF invalido" }, { status: 400 }); }
  const cpf = onlyDigits(body.cpf);
  if (cpf.length !== 11) return NextResponse.json({ error: "CPF deve ter 11 digitos" }, { status: 400 });

  const mafood = createAdminClient();

  // 1) Já existe em customers?
  const { data: existing, error: existingError } = await mafood
    .from("customers")
    .select("id, name, cpf, is_vip")
    .eq("cpf", cpf)
    .maybeSingle();
  if (existingError) {
    return internalErrorResponse(
      "customer-lookup",
      existingError,
      "Não foi possível consultar o cadastro"
    );
  }

  if (existing) {
    // Já cadastrado → cria sessão direto
    const token = await signCustomer({
      customer_id: existing.id,
      cpf: existing.cpf,
      name: existing.name,
      is_vip: existing.is_vip,
    });
    await setCustomerCookie(token);
    return NextResponse.json({ status: "existing" });
  }

  // 2) Está na lista_vip? (lê do schema public via cliente apropriado)
  const pub = createAdminClientPublic();
  const { data: vip, error: vipError } = await pub
    .from("lista_vip_publico")
    .select("id, nome, cpf, email, telefone")
    .eq("cpf", cpf)
    .maybeSingle();
  if (vipError) {
    return internalErrorResponse(
      "customer-lookup-vip",
      vipError,
      "Não foi possível consultar o cadastro"
    );
  }

  if (vip) {
    return NextResponse.json({
      status: "vip_match",
      prefill: {
        cpf,
        name: vip.nome,
        email: vip.email,
        phone: vip.telefone,
        lista_vip_id: vip.id,
      },
    });
  }

  return NextResponse.json({ status: "new", prefill: { cpf } });
}
