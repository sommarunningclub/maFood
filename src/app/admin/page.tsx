import { PageHeader } from "@/components/admin/page-header";
import { PDVS, ORDERS } from "@/lib/mock-data";
import { brl } from "@/lib/utils";
import { DashboardCharts } from "@/components/admin/dashboard-charts";

export default function AdminDashboard() {
  const totalSold = 8245;
  const ordersToday = 194;
  const avgTicket = totalSold / ordersToday;
  const commission = 1237;

  const kpis = [
    { label: "Total Vendido", value: brl(totalSold), accent: "text-palantir-green" },
    { label: "Pedidos Hoje", value: ordersToday, accent: "text-palantir-blue" },
    { label: "Ticket Médio", value: brl(avgTicket), accent: "text-palantir-text" },
    { label: "Comissão Hoje", value: brl(commission), accent: "text-palantir-yellow" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão operacional · tempo real" />
      <div className="p-4 sm:p-6">
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

        <DashboardCharts />

        {/* Painéis ranking + recentes — empilhados em <lg */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <div className="border border-palantir-border bg-palantir-surface">
            <div className="border-b border-palantir-border px-4 py-2">
              <h2 className="text-sm font-semibold text-white">Ranking de PDVs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {PDVS.map((p, i) => {
                    const share = [45, 28, 18, 6, 3][i] ?? 0;
                    return (
                      <tr key={p.id} className="border-t border-palantir-border">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="mono text-palantir-muted">{i + 1}.</span> {p.name}
                        </td>
                        <td className="px-4 py-2 w-full min-w-[80px]">
                          <div className="h-2 w-full bg-palantir-surface2">
                            <div
                              className="h-2 bg-palantir-blue"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                        </td>
                        <td className="mono px-4 py-2 text-right text-palantir-text whitespace-nowrap">
                          {share}%
                        </td>
                      </tr>
                    );
                  })}
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
                  {ORDERS.slice(0, 6).map((o) => (
                    <tr key={o.id} className="border-t border-palantir-border">
                      <td className="mono px-4 py-2 text-palantir-blue whitespace-nowrap">
                        #{o.number}
                      </td>
                      <td className="px-4 py-2 text-palantir-text truncate max-w-[160px]">
                        {o.pdv_name}
                      </td>
                      <td className="mono px-4 py-2 text-right text-palantir-text whitespace-nowrap">
                        {brl(o.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
