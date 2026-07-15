import { PageHeader } from "@/components/admin/page-header";
import { PdvsTable, type AdminPdvRow } from "@/components/admin/pdvs-table";
import { NewPdvButton } from "@/components/admin/new-pdv-dialog";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function PdvsPage() {
  const supabase = createAdminClient();

  const { data: venue } = await supabase
    .from("venues")
    .select("id, name")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("pdvs")
    .select(
      "id, venue_id, slug, name, category, logo_url, prep_time_min, commission_pct, gateway_pct, is_open, is_visible, sells_online, sort_order, wallet_balance, instagram_handle, pin_set_at"
    )
    .order("sort_order", { ascending: true });

  return (
    <>
      <PageHeader
        title="PDVs"
        subtitle={`${data?.length ?? 0} PDVs · arraste para reordenar · clique no PIN p/ liberar acesso`}
      />
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex justify-end">
          {venue && <NewPdvButton venueId={venue.id} />}
        </div>
        {error ? (
          <div className="border border-palantir-red/40 bg-palantir-red/10 px-4 py-3 text-sm text-palantir-red">
            Erro ao ler PDVs: {error.message}
          </div>
        ) : (
          <PdvsTable initial={(data ?? []) as AdminPdvRow[]} />
        )}
      </div>
    </>
  );
}
