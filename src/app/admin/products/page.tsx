import { PageHeader } from "@/components/admin/page-header";
import { ProductsView } from "@/components/admin/products-view";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const supabase = createAdminClient();

  const [{ data: pdvs }, { data: products }] = await Promise.all([
    supabase
      .from("pdvs")
      .select("id, slug, name, logo_url, commission_pct, gateway_pct")
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("id, pdv_id, category_id, category, name, description, price, image_url, status")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader title="Produtos" subtitle={`${products?.length ?? 0} itens · ${pdvs?.length ?? 0} PDVs`} />
      <div className="p-6">
        <ProductsView
          pdvs={(pdvs ?? []).map((p) => ({
            ...p,
            commission_pct: Number(p.commission_pct),
            gateway_pct: Number(p.gateway_pct),
          }))}
          initialProducts={(products ?? []).map((p) => ({
            ...p,
            price: Number(p.price),
          }))}
        />
      </div>
    </>
  );
}
