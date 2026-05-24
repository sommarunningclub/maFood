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
      <div className="p-6">
        <div className="border border-palantir-border bg-palantir-surface">
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
                  <td className="mono px-4 py-2 font-bold text-palantir-blue">{c.code}</td>
                  <td className="mono px-4 py-2 text-palantir-text">
                    {c.type === "percent" ? `${c.value}%` : brl(c.value)}
                  </td>
                  <td className="mono px-4 py-2 text-palantir-muted">{brl(c.min_order)}</td>
                  <td className="mono px-4 py-2 text-palantir-muted">
                    {c.used}/{c.max_uses}
                  </td>
                  <td className="mono px-4 py-2 text-palantir-muted">{c.valid_until}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggle(c.id)}
                      className={`mono rounded-admin px-2 py-1 text-[10px] font-bold ${
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
      </div>
    </>
  );
}
