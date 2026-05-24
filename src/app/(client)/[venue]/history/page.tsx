import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { StatusBadge } from "@/components/ui/badge";
import { brl, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ params }: { params: { venue: string } }) {
  const session = await getCustomerSession();
  if (!session) redirect(`/${params.venue}/login?next=/${params.venue}/history`);

  const supabase = createAdminClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, number, total, method, status, created_at, pdv_id")
    .eq("customer_id", session.customer_id)
    .order("created_at", { ascending: false })
    .limit(50);

  const pdvIds = Array.from(new Set((orders ?? []).map((o) => o.pdv_id)));
  const { data: pdvs } = await supabase
    .from("pdvs")
    .select("id, name, logo_url")
    .in("id", pdvIds.length ? pdvIds : ["00000000-0000-0000-0000-000000000000"]);
  const pdvById = new Map((pdvs ?? []).map((p) => [p.id, p]));

  return (
    <div className="min-h-screen p-5 somma-grain">
      <header className="flex items-center gap-3">
        <Link href={`/${params.venue}`} className="text-somma-muted text-xl">
          ←
        </Link>
        <h1 className="text-2xl text-white font-display uppercase tracking-wide">
          Meus pedidos
        </h1>
      </header>

      {!orders || orders.length === 0 ? (
        <div className="mt-20 text-center text-somma-muted">
          <p className="text-5xl mb-3">🧾</p>
          <p>Nenhum pedido ainda</p>
          <Link
            href={`/${params.venue}`}
            className="num mt-4 inline-block text-somma-orange underline text-sm"
          >
            Ver praça de alimentação
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {orders.map((o) => {
            const pdv = pdvById.get(o.pdv_id);
            return (
              <Link
                key={o.id}
                href={`/${params.venue}/order/${o.id}`}
                className="block rounded-client border border-somma-border bg-somma-surface p-4 active:scale-[0.98] transition-transform"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {pdv && <span className="text-xl">{pdv.logo_url}</span>}
                    <div>
                      <p className="text-white font-medium">{pdv?.name ?? "PDV"}</p>
                      <p className="num text-[11px] text-somma-muted">
                        #{o.number} · {formatTime(o.created_at)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={o.status as Parameters<typeof StatusBadge>[0]["status"]} />
                </div>
                <div className="flex justify-between items-end mt-2">
                  <p className="num text-xs text-somma-muted">
                    {o.method.toUpperCase()}
                  </p>
                  <p className="num text-somma-orange font-semibold">{brl(Number(o.total))}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
