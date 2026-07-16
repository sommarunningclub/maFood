import { NextResponse } from "next/server";
import { z } from "zod";
import { getPdvSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { internalErrorResponse } from "@/lib/server-errors";

const Body = z.object({
  cpf: z.string().transform((value) => value.replace(/\D/g, "")).pipe(
    z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos")
  ),
});

/**
 * Busca usada pelo operador do PDV ao criar um pedido manual.
 * Não cria sessão de cliente e não depende da lista VIP.
 */
export async function POST(req: Request) {
  const session = await getPdvSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : "Dados inválidos";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, cpf, name, email, phone")
    .eq("cpf", body.cpf)
    .maybeSingle();

  if (error) {
    return internalErrorResponse(
      "pdv-customer-lookup",
      error,
      "Não foi possível consultar o cadastro"
    );
  }

  if (!customer) {
    return NextResponse.json({
      status: "new",
      customer: {
        cpf: body.cpf,
        name: "",
        email: null,
        phone: null,
      },
    });
  }

  return NextResponse.json({
    status: "existing",
    customer: {
      cpf: customer.cpf,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    },
  });
}
