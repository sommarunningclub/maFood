import { PageHeader } from "@/components/admin/page-header";
import { CouponsView } from "@/components/admin/coupons-view";
import { logServerError } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Coupon } from "@/types";

export const dynamic = "force-dynamic";

type CouponRecord = {
  id: string;
  venue_id: string | null;
  code: string;
  type: "percent" | "fixed";
  value: number | string;
  min_order: number | string;
  max_uses: number;
  used: number;
  is_active: boolean;
  valid_until: string | null;
};

export default async function CouponsPage() {
  let coupons: Coupon[] = [];
  let errorReference: string | null = null;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("coupons")
      .select(
        "id, venue_id, code, type, value, min_order, max_uses, used, is_active, valid_until"
      )
      .order("code")
      .returns<CouponRecord[]>();
    if (error) throw error;
    coupons = (data ?? []).map((coupon) => ({
      ...coupon,
      value: Number(coupon.value),
      min_order: Number(coupon.min_order),
    }));
  } catch (error) {
    errorReference = logServerError("admin-coupons", error);
  }

  return (
    <>
      <PageHeader title="Cupons" subtitle={`${coupons.length} cupons`} />
      {errorReference ? (
        <div className="p-4 sm:p-6">
          <div
            role="alert"
            className="border border-palantir-red/40 bg-palantir-red/10 px-4 py-3 text-sm text-palantir-red"
          >
            Não foi possível carregar os cupons. Referência:{" "}
            <span className="mono">{errorReference}</span>
          </div>
        </div>
      ) : (
        <CouponsView initialCoupons={coupons} />
      )}
    </>
  );
}
