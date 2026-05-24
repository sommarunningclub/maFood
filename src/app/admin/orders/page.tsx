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
      <div className="p-6">
        {/* Filtros */}
        <div className="mb-4 flex gap-3">
          <select
            value={pdv}
            onChange={(e) => setPdv(e.target.value)}
            className="rounded-admin border border-palantir-border bg-palantir-surface px-3 py-2 text-sm text-palantir-text"
          >
            <option value="all">Todos os PDVs</option>
            {PDVS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`mono rounded-admin border px-3 py-2 text-xs uppercase ${
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

        <div className="border border-palantir-border bg-palantir-surface">
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
                  <td className="mono px-4 py-2 text-palantir-blue">#{o.number}</td>
                  <td className="px-4 py-2 text-palantir-text">{o.pdv_name}</td>
                  <td className="px-4 py-2 text-palantir-text">{o.customer_name}</td>
                  <td className="mono px-4 py-2 text-palantir-muted">
                    {o.items.reduce((s, i) => s + i.qty, 0)}
                  </td>
                  <td className="mono px-4 py-2 text-palantir-muted">
                    {o.method.toUpperCase()}
                  </td>
                  <td className="mono px-4 py-2 text-palantir-text">{brl(o.total)}</td>
                  <td className="mono px-4 py-2 text-palantir-muted">
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
      </div>
    </>
  );
}
