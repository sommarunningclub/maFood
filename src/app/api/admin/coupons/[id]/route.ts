import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/admin-session";
import { internalErrorResponse } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";

interface Params {
  params: { id: string };
}

const BodySchema = z.object({
  is_active: z.boolean(),
});

export async function PATCH(req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Cupom não encontrado" }, { status: 404 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (error) {
    return internalErrorResponse(
      "admin-coupon-client",
      error,
      "Não foi possível atualizar o cupom"
    );
  }

  const { data, error } = await supabase
    .from("coupons")
    .update({ is_active: parsed.data.is_active })
    .eq("id", params.id)
    .select("id")
    .maybeSingle();
  if (error) {
    return internalErrorResponse(
      "admin-coupon-update",
      error,
      "Não foi possível atualizar o cupom"
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Cupom não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, is_active: parsed.data.is_active });
}
