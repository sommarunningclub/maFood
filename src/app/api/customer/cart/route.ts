import { NextResponse } from "next/server";
import { z } from "zod";
import { effectivePrice } from "@/lib/pricing";
import { internalErrorResponse } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  pdv_id: z.string().uuid(),
  product_ids: z.array(z.string().uuid()).min(1).max(100),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Carrinho inválido" }, { status: 400 });
  }

  const productIds = [...new Set(parsed.data.product_ids)];
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (error) {
    return internalErrorResponse(
      "customer-cart-client",
      error,
      "Não foi possível atualizar a sacola"
    );
  }
  const [{ data: pdv, error: pdvError }, { data: products, error: productsError }] =
    await Promise.all([
      supabase
        .from("pdvs")
        .select("id, pay_at_counter")
        .eq("id", parsed.data.pdv_id)
        .maybeSingle(),
      supabase
        .from("products")
        .select(
          "id, pdv_id, category, name, description, image_url, price, sale_price, status, sizes"
        )
        .eq("pdv_id", parsed.data.pdv_id)
        .in("id", productIds),
    ]);

  if (pdvError || productsError) {
    return internalErrorResponse(
      "customer-cart-refresh",
      pdvError ?? productsError,
      "Não foi possível atualizar a sacola"
    );
  }
  if (!pdv) {
    return NextResponse.json({ error: "PDV não encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    pdv: {
      id: pdv.id,
      pay_at_counter: Boolean(pdv.pay_at_counter),
    },
    products: (products ?? []).map((product) => ({
      id: product.id,
      pdv_id: product.pdv_id,
      category: product.category ?? "",
      name: product.name,
      description: product.description ?? "",
      image_url: product.image_url ?? "",
      price: effectivePrice(product),
      sale_price: product.sale_price == null ? null : Number(product.sale_price),
      sizes: Array.isArray(product.sizes) ? product.sizes : null,
      status: product.status,
    })),
  });
}
