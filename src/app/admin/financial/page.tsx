import { PageHeader } from "@/components/admin/page-header";
import { logServerError } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { brl } from "@/lib/utils";
import {
  asaasEnabled,
  getAccountFees,
  getPayment,
  type AsaasAccountFees,
} from "@/lib/asaas";

export const dynamic = "force-dynamic";

const REVENUE_STATUSES = ["paid", "preparing", "ready", "partial", "delivered"];

type FinancialPdv = {
  id: string;
  name: string;
  commission_pct: number | string | null;
  gateway_pct: number | string | null;
};

type FinancialOrder = {
  id: string;
  pdv_id: string;
  total: number | string | null;
  method: "pix" | "card" | "counter";
  asaas_payment_id: string | null;
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
  let asaasErrorReference: string | null = null;
  let accountFees: AsaasAccountFees | null = null;
  const actualFeeByPayment = new Map<string, number>();

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
        .select("id, pdv_id, total, method, asaas_payment_id")
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

  if (asaasEnabled) {
    const paymentIds = Array.from(
      new Set(
        orders
          .map((order) => order.asaas_payment_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const [feesResult, ...paymentResults] = await Promise.allSettled([
      getAccountFees(),
      ...paymentIds.map((id) => getPayment(id)),
    ]);

    if (feesResult.status === "fulfilled") {
      accountFees = feesResult.value;
    } else {
      asaasErrorReference = logServerError("admin-financial-asaas-fees", feesResult.reason);
    }

    paymentResults.forEach((result, index) => {
      if (result.status !== "fulfilled") return;
      const value = Number(result.value.value);
      const netValue = Number(result.value.netValue);
      if (!Number.isFinite(value) || !Number.isFinite(netValue)) return;
      actualFeeByPayment.set(
        paymentIds[index],
        Math.max(0, Math.round((value - netValue) * 100) / 100)
      );
    });
  }

  const pdvById = new Map(pdvs.map((pdv) => [pdv.id, pdv]));
  const totalsByPdv = new Map<
    string,
    {
      final: number;
      commission: number;
      gateway: number;
      actualGateway: number;
      actualCount: number;
      estimatedCount: number;
      net: number;
    }
  >();
  for (const order of orders) {
    const pdv = pdvById.get(order.pdv_id);
    const value = Number(order.total ?? 0);
    if (!pdv || !Number.isFinite(value)) continue;
    const commission = (value * Number(pdv.commission_pct ?? 0)) / 100;
    const actualGateway = order.asaas_payment_id
      ? actualFeeByPayment.get(order.asaas_payment_id)
      : undefined;
    const gateway =
      order.method === "counter"
        ? 0
        : actualGateway ?? (value * Number(pdv.gateway_pct ?? 0)) / 100;
    const current = totalsByPdv.get(order.pdv_id) ?? {
      final: 0,
      commission: 0,
      gateway: 0,
      actualGateway: 0,
      actualCount: 0,
      estimatedCount: 0,
      net: 0,
    };
    totalsByPdv.set(order.pdv_id, {
      final: current.final + value,
      commission: current.commission + commission,
      gateway: current.gateway + gateway,
      actualGateway: current.actualGateway + (actualGateway ?? 0),
      actualCount: current.actualCount + (actualGateway !== undefined ? 1 : 0),
      estimatedCount:
        current.estimatedCount +
        (order.method !== "counter" && actualGateway === undefined ? 1 : 0),
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
      actualGateway: 0,
      actualCount: 0,
      estimatedCount: 0,
      net: 0,
    };
    return { pdv, payout: latestPayoutByPdv.get(pdv.id) ?? null, ...totals };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      final: acc.final + r.final,
      commission: acc.commission + r.commission,
      gateway: acc.gateway + r.gateway,
      actualGateway: acc.actualGateway + r.actualGateway,
      actualCount: acc.actualCount + r.actualCount,
      estimatedCount: acc.estimatedCount + r.estimatedCount,
      net: acc.net + r.net,
    }),
    {
      final: 0,
      commission: 0,
      gateway: 0,
      actualGateway: 0,
      actualCount: 0,
      estimatedCount: 0,
      net: 0,
    }
  );

  const pixFeeLabel = describePixFee(accountFees?.payment?.pix);
  const cardFeeLabel = describeCardFee(accountFees?.payment?.creditCard);

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
        {asaasErrorReference && (
          <div
            role="alert"
            className="mb-4 border border-palantir-yellow/40 bg-palantir-yellow/10 px-4 py-3 text-sm text-palantir-yellow"
          >
            As tarifas reais do Asaas não puderam ser consultadas; valores sem
            `netValue` usam a estimativa cadastrada no PDV. Referência:{" "}
            <span className="mono">{asaasErrorReference}</span>
          </div>
        )}

        {accountFees && (
          <div className="mb-4 grid grid-cols-1 gap-px bg-palantir-border sm:grid-cols-2">
            <div className="bg-palantir-surface p-4">
              <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
                Tarifa Asaas · Pix
              </p>
              <p className="mono mt-1 text-base font-semibold text-palantir-text">
                {pixFeeLabel}
              </p>
            </div>
            <div className="bg-palantir-surface p-4">
              <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
                Tarifa Asaas · Cartão 1x
              </p>
              <p className="mono mt-1 text-base font-semibold text-palantir-text">
                {cardFeeLabel}
              </p>
            </div>
          </div>
        )}

        {/* KPIs financeiros */}
        <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-px bg-palantir-border">
          {[
            { label: "Bruto total", value: brl(totals.final), accent: "text-palantir-text" },
            { label: "Comissão maFood", value: brl(totals.commission), accent: "text-palantir-yellow" },
            {
              label: totals.actualCount > 0 ? "Taxa Asaas real" : "Taxa gateway estimada",
              value:
                totals.actualCount > 0
                  ? brl(totals.actualGateway)
                  : brl(totals.gateway),
              accent: "text-palantir-red",
              sub:
                totals.actualCount > 0
                  ? `${totals.actualCount} cobrança(s) consultada(s)`
                  : `${totals.estimatedCount} cobrança(s) estimada(s)`,
            },
            { label: "Líquido aos PDVs", value: brl(totals.net), accent: "text-palantir-green" },
          ].map((k) => (
            <div key={k.label} className="bg-palantir-surface p-3 sm:p-4">
              <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
                {k.label}
              </p>
              <p className={`mono mt-1 text-fluid-xl font-bold ${k.accent}`}>{k.value}</p>
              {"sub" in k && k.sub && (
                <p className="mono mt-1 text-[9px] text-palantir-muted">{k.sub}</p>
              )}
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
                <th className="px-4 py-2 text-right">Asaas</th>
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
                  <td className="mono px-4 py-2 text-right text-palantir-red whitespace-nowrap">
                    {brl(r.gateway)}
                    <span className="block text-[9px] text-palantir-muted">
                      {r.actualCount > 0
                        ? `${r.actualCount} real`
                        : r.estimatedCount > 0
                          ? "estimado"
                          : "sem taxa"}
                    </span>
                  </td>
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

type PixFee = NonNullable<NonNullable<AsaasAccountFees["payment"]>["pix"]>;
type CardFee = NonNullable<NonNullable<AsaasAccountFees["payment"]>["creditCard"]>;

function activeDiscount(expires: string | null | undefined) {
  if (!expires) return false;
  const time = new Date(expires.replace(" ", "T")).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function describePixFee(fee: PixFee | undefined) {
  if (!fee) return "Não informado";
  const freeRemaining = Math.max(
    0,
    Number(fee.monthlyCreditsWithoutFee ?? 0) -
      Number(fee.creditsReceivedOfCurrentMonth ?? 0)
  );
  const free = freeRemaining > 0 ? ` · ${freeRemaining} grátis restantes` : "";
  if (
    fee.fixedFeeValueWithDiscount != null &&
    activeDiscount(fee.discountExpiration)
  ) {
    return `${brl(Number(fee.fixedFeeValueWithDiscount))} por cobrança${free}`;
  }
  if (fee.fixedFeeValue != null) {
    return `${brl(Number(fee.fixedFeeValue))} por cobrança${free}`;
  }
  if (fee.percentageFee != null) {
    const limits = [
      fee.minimumFeeValue != null ? `mín. ${brl(Number(fee.minimumFeeValue))}` : null,
      fee.maximumFeeValue != null ? `máx. ${brl(Number(fee.maximumFeeValue))}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return `${Number(fee.percentageFee).toLocaleString("pt-BR")}%${
      limits ? ` · ${limits}` : ""
    }${free}`;
  }
  return `Sem tarifa informada${free}`;
}

function describeCardFee(fee: CardFee | undefined) {
  if (!fee) return "Não informado";
  const percentage =
    fee.discountOneInstallmentPercentage != null &&
    activeDiscount(fee.discountExpiration)
      ? Number(fee.discountOneInstallmentPercentage)
      : Number(fee.oneInstallmentPercentage ?? 0);
  const operation = Number(fee.operationValue ?? 0);
  return `${percentage.toLocaleString("pt-BR")}%${
    operation > 0 ? ` + ${brl(operation)} por cobrança` : ""
  }`;
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
