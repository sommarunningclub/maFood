/*
  Perfil do cliente logado.
  GET   → dados do customer + contagem de pedidos
  PATCH → atualiza name / email / phone / endereço (CPF é imutável)
*/
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCustomerSession,
  signCustomer,
  setCustomerCookie,
} from "@/lib/auth/customer-session";

const CUSTOMER_SELECT =
  "id, name, cpf, email, phone, postal_code, address_number, address_complement, is_vip, created_at";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: customer, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .eq("id", session.customer_id)
    .maybeSingle();
  if (error || !customer) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", session.customer_id);

  return NextResponse.json({ customer, orders_count: count ?? 0 });
}

const Patch = z.object({
  name: z.string().min(2, "Nome muito curto").max(120).optional(),
  email: z.string().email("E-mail inválido").or(z.literal("")).optional(),
  phone: z.string().max(20).or(z.literal("")).optional(),
  postal_code: z.string().max(9).or(z.literal("")).optional(),
  address_number: z.string().max(20).or(z.literal("")).optional(),
  address_complement: z.string().max(60).optional().nullable().or(z.literal("")),
});

export async function PATCH(req: Request) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof Patch>;
  try {
    body = Patch.parse(await req.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.email !== undefined) patch.email = body.email.trim() || null;
  if (body.phone !== undefined) {
    const digits = body.phone.replace(/\D/g, "");
    patch.phone = digits || null;
  }
  if (body.postal_code !== undefined) {
    const cep = body.postal_code.replace(/\D/g, "");
    patch.postal_code = cep.length === 8 ? cep : null;
  }
  if (body.address_number !== undefined) {
    patch.address_number = body.address_number.trim() || null;
  }
  if (body.address_complement !== undefined) {
    patch.address_complement =
      body.address_complement == null
        ? null
        : body.address_complement.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: updated, error } = await supabase
    .from("customers")
    .update(patch)
    .eq("id", session.customer_id)
    .select(CUSTOMER_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (patch.name && patch.name !== session.name) {
    const token = await signCustomer({
      customer_id: session.customer_id,
      cpf: session.cpf,
      name: updated.name,
      is_vip: session.is_vip,
    });
    await setCustomerCookie(token);
  }

  return NextResponse.json({ ok: true, customer: updated });
}
