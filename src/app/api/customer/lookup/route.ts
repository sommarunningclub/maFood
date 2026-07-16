import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { signCustomer, attachCustomerCookie } from "@/lib/auth/customer-session";
import { internalErrorResponse } from "@/lib/server-errors";
import { lookupCustomerDirectory } from "@/lib/customer-directory";

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
    const res = NextResponse.json({ status: "existing" });
    return attachCustomerCookie(res, token);
  }

  // 2) Reaproveita o que existir nas bases Somma. Cada fonte é tolerante a
  // falha para um CPF realmente novo nunca ficar impedido de se cadastrar.
  const directory = await lookupCustomerDirectory(cpf);
  if (directory.found) {
    return NextResponse.json({
      status: directory.isVip ? "vip_match" : "profile_match",
      prefill: directory.prefill,
    });
  }

  return NextResponse.json({ status: "new", prefill: directory.prefill });
}
