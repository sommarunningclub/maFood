import "server-only";

import { createAdminClientPublic } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/server-errors";

export interface CustomerDirectoryPrefill {
  cpf: string;
  name?: string;
  email?: string;
  phone?: string;
  postal_code?: string;
  lista_vip_id?: string;
}

export interface CustomerDirectoryMatch {
  found: boolean;
  isVip: boolean;
  prefill: CustomerDirectoryPrefill;
}

function maskCpf(cpf: string) {
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text) return text;
  }
  return undefined;
}

function normalizePhone(value: string | undefined) {
  if (!value) return undefined;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  return digits.length >= 10 ? digits.slice(-11) : undefined;
}

function normalizePostalCode(value: string | undefined) {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 ? digits : undefined;
}

/**
 * Consolida dados mínimos de cadastro encontrados nas bases do ecossistema
 * Somma. Falha em uma fonte não pode bloquear o primeiro acesso.
 */
export async function lookupCustomerDirectory(
  rawCpf: string
): Promise<CustomerDirectoryMatch> {
  const cpf = rawCpf.replace(/\D/g, "");
  const maskedCpf = maskCpf(cpf);
  const cpfFilter = `cpf.eq.${cpf},cpf.eq.${maskedCpf}`;
  const publicDb = createAdminClientPublic();

  const [vipResult, siteResult, checkinResult, memberResult, insiderResult] =
    await Promise.all([
      publicDb
        .from("lista_vip")
        .select("id, nome, email, telefone")
        .or(cpfFilter)
        .limit(1)
        .maybeSingle(),
      publicDb
        .from("cadastro_site")
        .select("nome_completo, email, whatsapp, cep")
        .or(cpfFilter)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
      publicDb
        .from("checkins")
        .select("nome_completo, email, telefone")
        .or(cpfFilter)
        .order("data_hora_checkin", { ascending: false })
        .limit(1)
        .maybeSingle(),
      publicDb
        .from("members")
        .select("name, email, phone, address_postal_code")
        .or(cpfFilter)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Mantém compatibilidade com a antiga lista de insiders da landing.
      publicDb
        .from("dados_insiders")
        .select("id, nome")
        .or(cpfFilter)
        .limit(1)
        .maybeSingle(),
    ]);

  const results = [
    ["customer-directory-vip", vipResult],
    ["customer-directory-site", siteResult],
    ["customer-directory-checkins", checkinResult],
    ["customer-directory-members", memberResult],
    ["customer-directory-insiders", insiderResult],
  ] as const;
  for (const [context, result] of results) {
    if (result.error) logServerError(context, result.error);
  }

  const vip = vipResult.data;
  const site = siteResult.data;
  const checkin = checkinResult.data;
  const member = memberResult.data;
  const insider = insiderResult.data;
  const found = Boolean(vip || site || checkin || member || insider);
  const isVip = Boolean(vip || insider);

  const name = firstText(
    vip?.nome,
    member?.name,
    site?.nome_completo,
    checkin?.nome_completo,
    insider?.nome
  );
  const email = firstText(
    vip?.email,
    member?.email,
    site?.email,
    checkin?.email
  );
  const phone = normalizePhone(
    firstText(vip?.telefone, member?.phone, site?.whatsapp, checkin?.telefone)
  );
  const postalCode = normalizePostalCode(
    firstText(member?.address_postal_code, site?.cep)
  );

  return {
    found,
    isVip,
    prefill: {
      cpf,
      name,
      email,
      phone,
      postal_code: postalCode,
      lista_vip_id: vip?.id,
    },
  };
}
