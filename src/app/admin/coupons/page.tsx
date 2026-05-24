"use client";

import { useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { COUPONS } from "@/lib/mock-data";
import { brl } from "@/lib/utils";
import type { Coupon } from "@/types";

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>(COUPONS);

  function toggle(id: string) {
    setCoupons((c) =>
      c.map((x) => (x.id === id ? { ...x, is_active: !x.is_active } : x))
    );
  }

  return (
    <>
      <PageHeader title="Cupons" subtitle={`${coupons.length} cupons`} />
      <div className="p-4 sm:p-6">
        {/* Tabela desktop */}
        <div className="hidden md:block border border-palantir-border bg-palantir-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="mono border-b border-palantir-border text-left text-[10px] uppercase tracking-wider text-palantir-muted">
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Desconto</th>
                <th className="px-4 py-2">Mín.</th>
                <th className="px-4 py-2">Usos</th>
                <th className="px-4 py-2">Validade</th>
                <th className="px-4 py-2">Ativo</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-palantir-border hover:bg-palantir-surface2">
                  <td className="mono px-4 py-2 font-bold text-palantir-blue whitespace-nowrap">{c.code}</td>
                  <td className="mono px-4 py-2 text-palantir-text whitespace-nowrap">
                    {c.type === "percent" ? `${c.value}%` : brl(c.value)}
                  </td>
                  <td className="mono px-4 py-2 text-palantir-muted whitespace-nowrap">{brl(c.min_order)}</td>
                  <td className="mono px-4 py-2 text-palantir-muted whitespace-nowrap">
                    {c.used}/{c.max_uses}
                  </td>
                  <td className="mono px-4 py-2 text-palantir-muted whitespace-nowrap">{c.valid_until}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggle(c.id)}
                      className={`mono min-h-touch min-w-touch rounded-admin px-3 text-[10px] font-bold focus-ring-admin ${
                        c.is_active
                          ? "bg-palantir-green/15 text-palantir-green"
                          : "bg-palantir-muted/15 text-palantir-muted"
                      }`}
                    >
                      {c.is_active ? "ATIVO" : "INATIVO"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cards mobile */}
        <ul className="md:hidden space-y-2">
          {coupons.map((c) => (
            <li key={c.id} className="border border-palantir-border bg-palantir-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="mono font-bold text-palantir-blue text-sm">{c.code}</p>
                  <p className="mono text-palantir-text text-xs mt-0.5">
                    {c.type === "percent" ? `${c.value}% OFF` : `${brl(c.value)} OFF`}
                  </p>
                </div>
                <button
                  onClick={() => toggle(c.id)}
                  className={`mono shrink-0 min-h-touch min-w-touch rounded-admin px-3 text-[10px] font-bold focus-ring-admin ${
                    c.is_active
                      ? "bg-palantir-green/15 text-palantir-green"
                      : "bg-palantir-muted/15 text-palantir-muted"
                  }`}
                  aria-pressed={c.is_active}
                >
                  {c.is_active ? "ATIVO" : "INATIVO"}
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <Stat label="Mín." value={brl(c.min_order)} />
                <Stat label="Usos" value={`${c.used}/${c.max_uses}`} />
                <Stat label="Validade" value={c.valid_until} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mono text-palantir-muted uppercase tracking-wide">{label}</p>
      <p className="mono text-palantir-text truncate">{value}</p>
    </div>
  );
}
