import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { signCustomer, setCustomerCookie } from "@/lib/auth/customer-session";

const Body = z.object({
  cpf: z.string().min(11),
  name: z.string().min(2).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  lista_vip_id: z.string().uuid().optional().nullable(),
});

export async function POST(req: Request) {
  let body;
  try { body = Body.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const cpf = body.cpf.replace(/\D/g, "");
  if (cpf.length !== 11) return NextResponse.json({ error: "CPF invalido" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      cpf,
      name: body.name.trim(),
      email: body.email || null,
      phone: body.phone || null,
      is_vip: !!body.lista_vip_id,
      lista_vip_id: body.lista_vip_id || null,
    })
    .select("id, name, cpf, is_vip")
    .single();

  if (error) {
    // CPF duplicado
    if (error.code === "23505") {
      return NextResponse.json({ error: "CPF ja cadastrado" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const token = await signCustomer({
    customer_id: data.id,
    cpf: data.cpf,
    name: data.name,
    is_vip: data.is_vip,
  });
  await setCustomerCookie(token);

  return NextResponse.json({ ok: true, customer: data });
}
