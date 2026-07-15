import { PageHeader } from "@/components/admin/page-header";
import { logServerError } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { brl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const REVENUE_STATUSES = ["paid", "preparing", "ready", "partial", "delivered"];

type FinancialPdv = {
  id: string;
  name: string;
  commission_pct: number | string | null;
  gateway_pct: number | string | null;
};

type FinancialOrder = {
  pdv_id: string;
  total: number | string | null;
  method: "pix" | "card" | "counter";
};

type PayoutRecord = {
  pdv_id: string;
  status: string;
  period_end: string;
  created_at: string;
};

export default async function FinancialPage() {
  let pdvs: FinancialPdv[] = [];
  let orders: FinancialOrder[] = [];
  let payouts: PayoutRecord[] = [];
  let errorReference: string | null = null;

  try {
    const supabase = createAdminClient();
    const [pdvResult, orderResult, payoutResult] = await Promise.all([
      supabase
        .from("pdvs")
        .select("id, name, commission_pct, gateway_pct")
        .order("sort_order")
        .returns<FinancialPdv[]>(),
      supabase
        .from("orders")
        .select("pdv_id, total, method")
        .in("status", REVENUE_STATUSES)
        .returns<FinancialOrder[]>(),
      supabase
        .from("payouts")
        .select("pdv_id, status, period_end, created_at")
        .order("period_end", { ascending: false })
        .order("created_at", { ascending: false })
        .returns<PayoutRecord[]>(),
    ]);

    const loadError = pdvResult.error ?? orderResult.error ?? payoutResult.error;
    if (loadError) throw loadError;
    pdvs = pdvResult.data ?? [];
    orders = orderResult.data ?? [];
    payouts = payoutResult.data ?? [];
  } catch (error) {
    errorReference = logServerError("admin-financial", error);
  }

  const pdvById = new Map(pdvs.map((pdv) => [pdv.id, pdv]));
  const totalsByPdv = new Map<
    string,
    { final: number; commission: number; gateway: number; net: number }
  >();
  for (const order of orders) {
    const pdv = pdvById.get(order.pdv_id);
    const value = Number(order.total ?? 0);
    if (!pdv || !Number.isFinite(value)) continue;
    const commission = (value * Number(pdv.commission_pct ?? 0)) / 100;
    const gateway =
      order.method === "counter"
        ? 0
        : (value * Number(pdv.gateway_pct ?? 0)) / 100;
    const current = totalsByPdv.get(order.pdv_id) ?? {
      final: 0,
      commission: 0,
      gateway: 0,
      net: 0,
    };
    totalsByPdv.set(order.pdv_id, {
      final: current.final + value,
      commission: current.commission + commission,
      gateway: current.gateway + gateway,
      net: current.net + value - commission - gateway,
    });
  }

  const latestPayoutByPdv = new Map<string, PayoutRecord>();
  for (const payout of payouts) {
    if (!latestPayoutByPdv.has(payout.pdv_id)) {
      latestPayoutByPdv.set(payout.pdv_id, payout);
    }
  }

  const rows = pdvs.map((pdv) => {
    const totals = totalsByPdv.get(pdv.id) ?? {
      final: 0,
      commission: 0,
      gateway: 0,
      net: 0,
    };
    return { pdv, payout: latestPayoutByPdv.get(pdv.id) ?? null, ...totals };
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
      <PageHeader
        title="Financeiro"
        subtitle="Acumulado real de vendas confirmadas · repasses cadastrados"
      />
      <div className="p-4 sm:p-6">
        {errorReference && (
          <div
            role="alert"
            className="mb-4 border border-palantir-red/40 bg-palantir-red/10 px-4 py-3 text-sm text-palantir-red"
          >
            Não foi possível carregar o financeiro. Referência:{" "}
            <span className="mono">{errorReference}</span>
          </div>
        )}

        {/* KPIs financeiros */}
        <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-px bg-palantir-border">
          {[
            { label: "Bruto total", value: brl(totals.final), accent: "text-palantir-text" },
            { label: "Comissão maFood", value: brl(totals.commission), accent: "text-palantir-yellow" },
            { label: "Taxa gateway", value: brl(totals.gateway), accent: "text-palantir-red" },
            { label: "Líquido aos PDVs", value: brl(totals.net), accent: "text-palantir-green" },
          ].map((k) => (
            <div key={k.label} className="bg-palantir-surface p-3 sm:p-4">
              <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
                {k.label}
              </p>
              <p className={`mono mt-1 text-fluid-xl font-bold ${k.accent}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Tabela desktop */}
        <div className="hidden md:block border border-palantir-border bg-palantir-surface overflow-x-auto">
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
                  <td className="px-4 py-2 text-palantir-text whitespace-nowrap">{r.pdv.name}</td>
                  <td className="mono px-4 py-2 text-right text-palantir-text whitespace-nowrap">{brl(r.final)}</td>
                  <td className="mono px-4 py-2 text-right text-palantir-yellow whitespace-nowrap">{brl(r.commission)}</td>
                  <td className="mono px-4 py-2 text-right text-palantir-red whitespace-nowrap">{brl(r.gateway)}</td>
                  <td className="mono px-4 py-2 text-right text-palantir-green whitespace-nowrap">{brl(r.net)}</td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`mono rounded-admin px-2 py-0.5 text-[10px] ${payoutTone(r.payout?.status)}`}
                    >
                      {payoutLabel(r.payout?.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-palantir-muted">
                    Nenhum PDV cadastrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cards mobile */}
        <ul className="md:hidden space-y-2">
          {rows.map((r) => (
            <li key={r.pdv.id} className="border border-palantir-border bg-palantir-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-palantir-text font-medium truncate">{r.pdv.name}</p>
                <span
                  className={`mono shrink-0 rounded-admin px-2 py-0.5 text-[10px] ${payoutTone(r.payout?.status)}`}
                >
                  {payoutLabel(r.payout?.status)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <Stat label="Bruto" value={brl(r.final)} className="text-palantir-text" />
                <Stat label="Comissão" value={brl(r.commission)} className="text-palantir-yellow" />
                <Stat label="Gateway" value={brl(r.gateway)} className="text-palantir-red" />
                <Stat label="Líquido" value={brl(r.net)} className="text-palantir-green" />
              </div>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="border border-palantir-border bg-palantir-surface p-6 text-center text-palantir-muted">
              Nenhum PDV cadastrado
            </li>
          )}
        </ul>
      </div>
    </>
  );
}

function payoutLabel(status: string | undefined) {
  if (!status) return "SEM REPASSE";
  const normalized = status.toLowerCase();
  if (["paid", "completed", "liquidated"].includes(normalized)) return "LIQUIDADO";
  if (["pending", "processing"].includes(normalized)) return "PENDENTE";
  return normalized.replaceAll("_", " ").toUpperCase();
}

function payoutTone(status: string | undefined) {
  const normalized = status?.toLowerCase();
  if (normalized && ["paid", "completed", "liquidated"].includes(normalized)) {
    return "bg-palantir-green/15 text-palantir-green";
  }
  if (normalized && ["pending", "processing"].includes(normalized)) {
    return "bg-palantir-yellow/15 text-palantir-yellow";
  }
  return "bg-palantir-muted/15 text-palantir-muted";
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="mono text-palantir-muted uppercase tracking-wide">{label}</p>
      <p className={`mono ${className ?? "text-palantir-text"}`}>{value}</p>
    </div>
  );
}
