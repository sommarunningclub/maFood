import { PageHeader } from "@/components/admin/page-header";
import { brl } from "@/lib/utils";
import {
  DashboardCharts,
  type PrepPoint,
  type SalesPoint,
} from "@/components/admin/dashboard-charts";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/server-errors";

export const dynamic = "force-dynamic";

const REVENUE_STATUSES = ["paid", "preparing", "ready", "partial", "delivered"];

type PdvRecord = {
  id: string;
  name: string;
  commission_pct: number | string | null;
};

type DashboardOrder = {
  id: string;
  number: number;
  pdv_id: string;
  total: number | string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  ready_at: string | null;
  pdvs: { name: string | null } | null;
};

function currentSaoPauloRange() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const start = new Date(`${date}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function AdminDashboard() {
  let pdvs: PdvRecord[] = [];
  let todayOrders: DashboardOrder[] = [];
  let recentOrders: DashboardOrder[] = [];
  let errorReference: string | null = null;

  try {
    const supabase = createAdminClient();
    const range = currentSaoPauloRange();
    const [pdvResult, todayResult, recentResult] = await Promise.all([
      supabase
        .from("pdvs")
        .select("id, name, commission_pct")
        .order("sort_order")
        .returns<PdvRecord[]>(),
      supabase
        .from("orders")
        .select(
          "id, number, pdv_id, total, status, created_at, paid_at, ready_at, pdvs(name)"
        )
        .in("status", REVENUE_STATUSES)
        .gte("paid_at", range.start)
        .lt("paid_at", range.end)
        .order("paid_at", { ascending: true })
        .returns<DashboardOrder[]>(),
      supabase
        .from("orders")
        .select(
          "id, number, pdv_id, total, status, created_at, paid_at, ready_at, pdvs(name)"
        )
        .order("created_at", { ascending: false })
        .limit(6)
        .returns<DashboardOrder[]>(),
    ]);

    const loadError = pdvResult.error ?? todayResult.error ?? recentResult.error;
    if (loadError) throw loadError;
    pdvs = pdvResult.data ?? [];
    todayOrders = todayResult.data ?? [];
    recentOrders = recentResult.data ?? [];
  } catch (error) {
    errorReference = logServerError("admin-dashboard", error);
  }

  const pdvById = new Map(pdvs.map((pdv) => [pdv.id, pdv]));
  const revenueByPdv = new Map<string, number>();
  const totalSold = todayOrders.reduce((sum, order) => {
    const total = Number(order.total ?? 0);
    revenueByPdv.set(order.pdv_id, (revenueByPdv.get(order.pdv_id) ?? 0) + total);
    return sum + total;
  }, 0);
  const ordersToday = todayOrders.length;
  const avgTicket = ordersToday > 0 ? totalSold / ordersToday : 0;
  const commission = todayOrders.reduce((sum, order) => {
    const rate = Number(pdvById.get(order.pdv_id)?.commission_pct ?? 0);
    return sum + (Number(order.total ?? 0) * rate) / 100;
  }, 0);

  const kpis = [
    { label: "Total Vendido", value: brl(totalSold), accent: "text-palantir-green" },
    { label: "Pedidos Hoje", value: ordersToday, accent: "text-palantir-blue" },
    { label: "Ticket Médio", value: brl(avgTicket), accent: "text-palantir-text" },
    { label: "Comissão Hoje", value: brl(commission), accent: "text-palantir-yellow" },
  ];

  const ranking = pdvs
    .map((pdv) => ({ pdv, revenue: revenueByPdv.get(pdv.id) ?? 0 }))
    .filter((row) => row.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const hourTotals = new Map<number, number>();
  for (const order of todayOrders) {
    if (!order.paid_at) continue;
    const hour = Number(
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        hour12: false,
      }).format(new Date(order.paid_at))
    );
    hourTotals.set(hour, (hourTotals.get(hour) ?? 0) + Number(order.total ?? 0));
  }
  let sales: SalesPoint[] = [];
  if (hourTotals.size > 0) {
    const populatedHours = [...hourTotals.keys()];
    const first = Math.max(0, Math.min(...populatedHours) - 1);
    const last = Math.min(23, Math.max(...populatedHours) + 1);
    sales = Array.from({ length: last - first + 1 }, (_, index) => {
      const hour = first + index;
      return { h: `${String(hour).padStart(2, "0")}h`, v: hourTotals.get(hour) ?? 0 };
    });
  }

  const prepByPdv = new Map<string, number[]>();
  for (const order of todayOrders) {
    if (!order.paid_at || !order.ready_at) continue;
    const minutes =
      (new Date(order.ready_at).getTime() - new Date(order.paid_at).getTime()) / 60_000;
    if (!Number.isFinite(minutes) || minutes < 0) continue;
    const samples = prepByPdv.get(order.pdv_id) ?? [];
    samples.push(minutes);
    prepByPdv.set(order.pdv_id, samples);
  }
  const prep: PrepPoint[] = [...prepByPdv.entries()].map(([pdvId, samples]) => ({
    pdv: (pdvById.get(pdvId)?.name ?? "PDV").slice(0, 16),
    min: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(1)),
  }));

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Dados reais · vendas confirmadas hoje" />
      <div className="p-4 sm:p-6">
        {errorReference && (
          <div
            role="alert"
            className="mb-4 border border-palantir-red/40 bg-palantir-red/10 px-4 py-3 text-sm text-palantir-red"
          >
            Não foi possível carregar os indicadores. Referência:{" "}
            <span className="mono">{errorReference}</span>
          </div>
        )}

        {/* KPIs — 1 col → 2 col (sm) → 4 col (lg) */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-palantir-border">
          {kpis.map((k) => (
            <div key={k.label} className="bg-palantir-surface p-4">
              <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
                {k.label}
              </p>
              <p className={`mono mt-1 text-fluid-2xl font-bold ${k.accent}`}>{k.value}</p>
            </div>
          ))}
        </div>

        <DashboardCharts sales={sales} prep={prep} />

        {/* Painéis ranking + recentes — empilhados em <lg */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <div className="border border-palantir-border bg-palantir-surface">
            <div className="border-b border-palantir-border px-4 py-2">
              <h2 className="text-sm font-semibold text-white">Ranking de PDVs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {ranking.map(({ pdv, revenue }, i) => {
                    const share = totalSold > 0 ? (revenue / totalSold) * 100 : 0;
                    return (
                      <tr key={pdv.id} className="border-t border-palantir-border">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="mono text-palantir-muted">{i + 1}.</span>{" "}
                          {pdv.name}
                        </td>
                        <td className="px-4 py-2 w-full min-w-[80px]">
                          <div className="h-2 w-full bg-palantir-surface2">
                            <div
                              className="h-2 bg-palantir-blue"
                              style={{ width: `${Math.min(100, share)}%` }}
                            />
                          </div>
                        </td>
                        <td className="mono px-4 py-2 text-right text-palantir-text whitespace-nowrap">
                          {share.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                  {ranking.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-palantir-muted">
                        Nenhum PDV com venda confirmada hoje
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-palantir-border bg-palantir-surface">
            <div className="border-b border-palantir-border px-4 py-2">
              <h2 className="text-sm font-semibold text-white">Pedidos Recentes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-t border-palantir-border">
                      <td className="mono px-4 py-2 text-palantir-blue whitespace-nowrap">
                        #{order.number}
                      </td>
                      <td className="px-4 py-2 text-palantir-text truncate max-w-[160px]">
                        {order.pdvs?.name ?? "—"}
                      </td>
                      <td className="mono px-4 py-2 text-right text-palantir-text whitespace-nowrap">
                        {brl(Number(order.total ?? 0))}
                      </td>
                    </tr>
                  ))}
                  {recentOrders.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-palantir-muted">
                        Nenhum pedido recente
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
