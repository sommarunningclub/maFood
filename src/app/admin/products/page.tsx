import { PageHeader } from "@/components/admin/page-header";
import { ProductsView } from "@/components/admin/products-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaasEnabled, getAccountFees, type AsaasAccountFees } from "@/lib/asaas";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const supabase = createAdminClient();
  let asaasFees: AsaasAccountFees | null = null;

  const [{ data: pdvs }, { data: products }, feesResult] = await Promise.all([
    supabase
      .from("pdvs")
      .select("id, slug, name, logo_url, commission_pct, gateway_pct")
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("id, pdv_id, category_id, category, name, description, price, sale_price, image_url, status, stock_quantity, supplier_cost")
      .order("created_at", { ascending: false }),
    asaasEnabled ? getAccountFees().catch(() => null) : Promise.resolve(null),
  ]);
  asaasFees = feesResult;

  return (
    <>
      <PageHeader title="Produtos" subtitle={`${products?.length ?? 0} itens · ${pdvs?.length ?? 0} PDVs`} />
      <div className="p-4 sm:p-6">
        <ProductsView
          pdvs={(pdvs ?? []).map((p) => ({
            ...p,
            commission_pct: Number(p.commission_pct),
            gateway_pct: Number(p.gateway_pct),
          }))}
          initialProducts={(products ?? []).map((p) => ({
            ...p,
            price: Number(p.price),
            sale_price: p.sale_price == null ? null : Number(p.sale_price),
          }))}
          asaasFees={asaasFees}
        />
      </div>
    </>
  );
}
