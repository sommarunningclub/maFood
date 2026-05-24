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
    .select("id, number, total, method, status, created_at, pdv_id, created_by")
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
    <div className="min-h-dvh-100 p-4 sm:p-5 pt-safe pb-safe somma-grain">
      <header className="flex items-center gap-3">
        <Link
          href={`/${params.venue}`}
          aria-label="Voltar à praça"
          className="grid size-touch -ml-2 place-items-center text-somma-muted hover:text-white focus-ring"
        >
          <span className="sr-only">Voltar</span>
          <span aria-hidden>←</span>
        </Link>
        <h1 className="text-fluid-2xl text-white font-display uppercase tracking-wide">
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
            const isPending = o.status === "pending";
            return (
              <Link
                key={o.id}
                href={`/${params.venue}/order/${o.id}`}
                className={`block rounded-client border p-4 min-h-touch active:scale-[0.98] transition-transform focus-ring ${
                  isPending
                    ? "border-somma-orange/60 bg-somma-orange/10 animate-pulse-orange"
                    : "border-somma-border bg-somma-surface"
                }`}
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
                {isPending && (
                  <p className="num text-[11px] text-somma-orange mt-2 font-semibold uppercase tracking-wide">
                    💳 Pagar agora →
                  </p>
                )}
                <div className="flex justify-between items-end mt-2">
                  <p className="num text-xs text-somma-muted">
                    {o.method.toUpperCase()}
                    {(o as { created_by?: string }).created_by === "pdv" && (
                      <span className="ml-2 text-somma-muted/60">· criado pelo PDV</span>
                    )}
                  </p>
                  <p
                    className={`num font-semibold ${
                      isPending ? "text-somma-orange" : "text-somma-orange"
                    }`}
                  >
                    {brl(Number(o.total))}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
