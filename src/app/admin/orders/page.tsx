"use client";

import { useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { ORDERS, PDVS } from "@/lib/mock-data";
import { brl, formatTime } from "@/lib/utils";
import type { OrderStatus } from "@/types";

const STATUSES: (OrderStatus | "all")[] = [
  "all",
  "paid",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
];

export default function OrdersPage() {
  const [pdv, setPdv] = useState("all");
  const [status, setStatus] = useState<OrderStatus | "all">("all");

  const rows = ORDERS.filter(
    (o) =>
      (pdv === "all" || o.pdv_id === pdv) &&
      (status === "all" || o.status === status)
  );

  return (
    <>
      <PageHeader title="Pedidos" subtitle={`${rows.length} registros`} />
      <div className="p-4 sm:p-6">
        {/* Filtros — empilham em mobile */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={pdv}
            onChange={(e) => setPdv(e.target.value)}
            className="rounded-admin border border-palantir-border bg-palantir-surface px-3 py-2 text-sm text-palantir-text min-h-touch focus-ring-admin w-full sm:w-auto"
          >
            <option value="all">Todos os PDVs</option>
            {PDVS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="-mx-4 sm:mx-0 flex gap-1 overflow-x-auto no-scrollbar px-4 sm:px-0">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`mono shrink-0 rounded-admin border px-3 min-h-touch text-xs uppercase focus-ring-admin ${
                  status === s
                    ? "border-palantir-blue text-palantir-blue"
                    : "border-palantir-border text-palantir-muted"
                }`}
              >
                {s === "all" ? "Todos" : s}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela desktop */}
        <div className="hidden md:block border border-palantir-border bg-palantir-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="mono border-b border-palantir-border text-left text-[10px] uppercase tracking-wider text-palantir-muted">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">PDV</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Itens</th>
                <th className="px-4 py-2">Método</th>
                <th className="px-4 py-2">Valor</th>
                <th className="px-4 py-2">Hora</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-palantir-border hover:bg-palantir-surface2"
                >
                  <td className="mono px-4 py-2 text-palantir-blue whitespace-nowrap">#{o.number}</td>
                  <td className="px-4 py-2 text-palantir-text whitespace-nowrap">{o.pdv_name}</td>
                  <td className="px-4 py-2 text-palantir-text">{o.customer_name}</td>
                  <td className="mono px-4 py-2 text-palantir-muted">
                    {o.items.reduce((s, i) => s + i.qty, 0)}
                  </td>
                  <td className="mono px-4 py-2 text-palantir-muted whitespace-nowrap">
                    {o.method.toUpperCase()}
                  </td>
                  <td className="mono px-4 py-2 text-palantir-text whitespace-nowrap">{brl(o.total)}</td>
                  <td className="mono px-4 py-2 text-palantir-muted whitespace-nowrap">
                    {formatTime(o.created_at)}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cards mobile */}
        <ul className="md:hidden space-y-2">
          {rows.map((o) => (
            <li
              key={o.id}
              className="border border-palantir-border bg-palantir-surface p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="mono text-palantir-blue text-sm">#{o.number}</p>
                  <p className="text-palantir-text text-sm truncate">{o.pdv_name}</p>
                  <p className="text-palantir-muted text-xs truncate">{o.customer_name}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <p className="mono text-palantir-muted uppercase tracking-wide">Itens</p>
                  <p className="mono text-palantir-text">
                    {o.items.reduce((s, i) => s + i.qty, 0)}
                  </p>
                </div>
                <div>
                  <p className="mono text-palantir-muted uppercase tracking-wide">Valor</p>
                  <p className="mono text-palantir-text">{brl(o.total)}</p>
                </div>
                <div className="text-right">
                  <p className="mono text-palantir-muted uppercase tracking-wide">Hora</p>
                  <p className="mono text-palantir-muted">{formatTime(o.created_at)}</p>
                </div>
              </div>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="border border-palantir-border bg-palantir-surface p-6 text-center text-sm text-palantir-muted">
              Nenhum pedido neste filtro
            </li>
          )}
        </ul>
      </div>
    </>
  );
}
