import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { signCustomer, setCustomerCookie } from "@/lib/auth/customer-session";
import { internalErrorResponse } from "@/lib/server-errors";

const Body = z.object({
  cpf: z.string().min(11),
  name: z.string().min(2).max(120),
  email: z.string().email("E-mail inválido"),
  phone: z.string().min(10, "Telefone inválido").max(20),
  postal_code: z.string().min(8, "CEP inválido").max(9),
  address_number: z.string().min(1, "Informe o número").max(20),
  address_complement: z.string().max(60).optional().nullable().or(z.literal("")),
  lista_vip_id: z.string().uuid().optional().nullable(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const cpf = body.cpf.replace(/\D/g, "");
  if (cpf.length !== 11) return NextResponse.json({ error: "CPF invalido" }, { status: 400 });

  const phone = body.phone.replace(/\D/g, "");
  const postalCode = body.postal_code.replace(/\D/g, "");
  if (phone.length < 10) {
    return NextResponse.json({ error: "Telefone inválido" }, { status: 400 });
  }
  if (postalCode.length !== 8) {
    return NextResponse.json({ error: "CEP inválido" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      cpf,
      name: body.name.trim(),
      email: body.email.trim(),
      phone,
      postal_code: postalCode,
      address_number: body.address_number.trim(),
      address_complement: body.address_complement?.trim() || null,
      is_vip: !!body.lista_vip_id,
      lista_vip_id: body.lista_vip_id || null,
    })
    .select("id, name, cpf, is_vip")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "CPF ja cadastrado" }, { status: 409 });
    }
    return internalErrorResponse(
      "customer-register",
      error,
      "Não foi possível concluir o cadastro"
    );
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
