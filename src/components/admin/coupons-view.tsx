"use client";

import { useState } from "react";
import { brl } from "@/lib/utils";
import type { Coupon } from "@/types";

export function CouponsView({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  async function toggle(coupon: Coupon) {
    if (pendingIds.has(coupon.id)) return;
    const nextActive = !coupon.is_active;
    setError(null);
    setPendingIds((current) => new Set(current).add(coupon.id));
    setCoupons((current) =>
      current.map((item) =>
        item.id === coupon.id ? { ...item, is_active: nextActive } : item
      )
    );

    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível atualizar o cupom");
      }
    } catch (requestError) {
      setCoupons((current) =>
        current.map((item) =>
          item.id === coupon.id ? { ...item, is_active: coupon.is_active } : item
        )
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível atualizar o cupom"
      );
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(coupon.id);
        return next;
      });
    }
  }

  return (
    <div className="p-4 sm:p-6">
      {error && (
        <div
          role="alert"
          className="mb-4 border border-palantir-red/40 bg-palantir-red/10 px-4 py-3 text-sm text-palantir-red"
        >
          {error}
        </div>
      )}

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
            {coupons.map((coupon) => (
              <tr
                key={coupon.id}
                className="border-t border-palantir-border hover:bg-palantir-surface2"
              >
                <td className="mono px-4 py-2 font-bold text-palantir-blue whitespace-nowrap">
                  {coupon.code}
                </td>
                <td className="mono px-4 py-2 text-palantir-text whitespace-nowrap">
                  {coupon.type === "percent" ? `${coupon.value}%` : brl(coupon.value)}
                </td>
                <td className="mono px-4 py-2 text-palantir-muted whitespace-nowrap">
                  {brl(coupon.min_order)}
                </td>
                <td className="mono px-4 py-2 text-palantir-muted whitespace-nowrap">
                  {usageLabel(coupon)}
                </td>
                <td className="mono px-4 py-2 text-palantir-muted whitespace-nowrap">
                  {dateLabel(coupon.valid_until)}
                </td>
                <td className="px-4 py-2">
                  <StatusButton
                    coupon={coupon}
                    pending={pendingIds.has(coupon.id)}
                    onToggle={() => void toggle(coupon)}
                  />
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-palantir-muted">
                  Nenhum cupom cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden space-y-2">
        {coupons.map((coupon) => (
          <li
            key={coupon.id}
            className="border border-palantir-border bg-palantir-surface p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="mono font-bold text-palantir-blue text-sm">{coupon.code}</p>
                <p className="mono text-palantir-text text-xs mt-0.5">
                  {coupon.type === "percent"
                    ? `${coupon.value}% OFF`
                    : `${brl(coupon.value)} OFF`}
                </p>
              </div>
              <StatusButton
                coupon={coupon}
                pending={pendingIds.has(coupon.id)}
                onToggle={() => void toggle(coupon)}
              />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <Stat label="Mín." value={brl(coupon.min_order)} />
              <Stat label="Usos" value={usageLabel(coupon)} />
              <Stat label="Validade" value={dateLabel(coupon.valid_until)} />
            </div>
          </li>
        ))}
        {coupons.length === 0 && (
          <li className="border border-palantir-border bg-palantir-surface p-6 text-center text-palantir-muted">
            Nenhum cupom cadastrado
          </li>
        )}
      </ul>
    </div>
  );
}

function StatusButton({
  coupon,
  pending,
  onToggle,
}: {
  coupon: Coupon;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={coupon.is_active}
      aria-label={`${coupon.is_active ? "Desativar" : "Ativar"} cupom ${coupon.code}`}
      className={`mono min-h-touch min-w-touch rounded-admin px-3 text-[10px] font-bold focus-ring-admin disabled:cursor-wait disabled:opacity-60 ${
        coupon.is_active
          ? "bg-palantir-green/15 text-palantir-green"
          : "bg-palantir-muted/15 text-palantir-muted"
      }`}
    >
      {pending ? "SALVANDO" : coupon.is_active ? "ATIVO" : "INATIVO"}
    </button>
  );
}

function usageLabel(coupon: Coupon) {
  return coupon.max_uses === 0 ? `${coupon.used}/∞` : `${coupon.used}/${coupon.max_uses}`;
}

function dateLabel(value: string | null) {
  if (!value) return "Sem prazo";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mono text-palantir-muted uppercase tracking-wide">{label}</p>
      <p className="mono text-palantir-text truncate">{value}</p>
    </div>
  );
}
