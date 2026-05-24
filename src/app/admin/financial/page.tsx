import { PageHeader } from "@/components/admin/page-header";
import { PDVS } from "@/lib/mock-data";
import { breakdownFromFinal } from "@/lib/pricing";
import { brl } from "@/lib/utils";

// Receita bruta por PDV (mock — derivada do share do dashboard)
const GROSS: Record<string, number> = {
  "pdv-smash": 3710,
  "pdv-beer": 2308,
  "pdv-acai": 1485,
  "pdv-coffee": 495,
  "pdv-store": 247,
};

export default function FinancialPage() {
  const rows = PDVS.map((p) => {
    const gross = GROSS[p.id] ?? 0;
    const b = breakdownFromFinal(gross, {
      commissionPct: p.commission_pct,
      gatewayPct: p.gateway_pct,
    });
    return { pdv: p, ...b };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      final: acc.final + r.final,
      commission: acc.commission + r.commission,
      gateway: acc.gateway + r.gateway,
      net: acc.net + r.net,
    }),
    { final: 0, commission: 0, gateway: 0, net: 0 }
  );

  return (
    <>
      <PageHeader title="Financeiro" subtitle="Espelho de repasses por PDV" />
      <div className="p-6">
        <div className="mb-6 grid grid-cols-4 gap-px bg-palantir-border">
          {[
            { label: "Bruto total", value: brl(totals.final), accent: "text-palantir-text" },
            { label: "Comissão maFood", value: brl(totals.commission), accent: "text-palantir-yellow" },
            { label: "Taxa gateway", value: brl(totals.gateway), accent: "text-palantir-red" },
            { label: "Líquido aos PDVs", value: brl(totals.net), accent: "text-palantir-green" },
          ].map((k) => (
            <div key={k.label} className="bg-palantir-surface p-4">
              <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
                {k.label}
              </p>
              <p className={`mono mt-1 text-xl font-bold ${k.accent}`}>{k.value}</p>
            </div>
          ))}
        </div>

        <div className="border border-palantir-border bg-palantir-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="mono border-b border-palantir-border text-left text-[10px] uppercase tracking-wider text-palantir-muted">
                <th className="px-4 py-2">PDV</th>
                <th className="px-4 py-2 text-right">Bruto</th>
                <th className="px-4 py-2 text-right">Comissão</th>
                <th className="px-4 py-2 text-right">Gateway</th>
                <th className="px-4 py-2 text-right">Líquido</th>
                <th className="px-4 py-2 text-right">Repasse</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pdv.id} className="border-t border-palantir-border hover:bg-palantir-surface2">
                  <td className="px-4 py-2 text-palantir-text">{r.pdv.name}</td>
                  <td className="mono px-4 py-2 text-right text-palantir-text">{brl(r.final)}</td>
                  <td className="mono px-4 py-2 text-right text-palantir-yellow">{brl(r.commission)}</td>
                  <td className="mono px-4 py-2 text-right text-palantir-red">{brl(r.gateway)}</td>
                  <td className="mono px-4 py-2 text-right text-palantir-green">{brl(r.net)}</td>
                  <td className="px-4 py-2 text-right">
                    <span className="mono rounded-admin bg-palantir-green/15 px-2 py-0.5 text-[10px] text-palantir-green">
                      LIQUIDADO
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
