"use client";

import { useState } from "react";
import {
  breakdownFromFinal,
  ceilToCharmPrice,
  finalFromNet,
  roundToCharmPrice,
} from "@/lib/pricing";
import { brl } from "@/lib/utils";
import { MoneyInput } from "@/components/money-input";

const RATES = { commissionPct: 15, gatewayPct: 3.6, taxPct: 0 };

type Mode = "final" | "net";

function charmFinal(raw: number, mode: Mode): number {
  if (raw <= 0) return 0;
  // No modo líquido, sobe para não furar a margem desejada.
  return mode === "net" ? ceilToCharmPrice(raw) : roundToCharmPrice(raw);
}

export function PriceEngine({ initial = 38 }: { initial?: number }) {
  const [mode, setMode] = useState<Mode>("final");
  const [input, setInput] = useState(() => roundToCharmPrice(initial) || initial);

  const rawFinal = mode === "final" ? input : finalFromNet(input, RATES);
  const final = charmFinal(rawFinal, mode);
  const b = breakdownFromFinal(final, RATES);
  const wasRounded = Math.round(rawFinal * 100) !== Math.round(final * 100);

  return (
    <div className="rounded-admin border border-palantir-border bg-palantir-bg p-4">
      <div className="mb-3 flex gap-1">
        {(["final", "net"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`mono rounded-admin border px-3 py-1.5 text-[11px] uppercase ${
              mode === m
                ? "border-palantir-blue text-palantir-blue"
                : "border-palantir-border text-palantir-muted"
            }`}
          >
            {m === "final" ? "Preço final" : "Líquido desejado"}
          </button>
        ))}
      </div>

      <label className="mono mb-3 block text-[11px] text-palantir-muted">
        {mode === "final" ? "Preço ao cliente (R$)" : "Líquido para o PDV (R$)"}
        <MoneyInput
          value={input}
          onChange={setInput}
          onBlur={() => {
            if (mode === "final" && input > 0) {
              setInput(roundToCharmPrice(input));
            }
          }}
          className="mono mt-1 w-full rounded-admin border border-palantir-border bg-palantir-surface px-3 py-2 text-base text-white"
        />
      </label>

      {mode === "final" && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[
            { label: ",00", value: Math.ceil(input || 0) || 1 },
            {
              label: ",99",
              value: Math.max(0.99, Math.floor(input || 0) + 0.99),
            },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setInput(roundToCharmPrice(opt.value))}
              className="mono rounded-admin border border-palantir-border px-2.5 py-1 text-[10px] uppercase text-palantir-muted hover:border-palantir-blue hover:text-palantir-blue focus-ring-admin"
            >
              Fechar em {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1 border-t border-palantir-border pt-3 text-sm">
        <Line label="Preço final" value={brl(b.final)} className="text-white" />
        <Line label={`Comissão maFood (${RATES.commissionPct}%)`} value={`− ${brl(b.commission)}`} className="text-palantir-red" />
        <Line label={`Taxa gateway (${RATES.gatewayPct}%)`} value={`− ${brl(b.gateway)}`} className="text-palantir-red" />
        <div className="flex justify-between border-t border-palantir-border pt-1">
          <span className="mono text-palantir-muted">Líquido PDV</span>
          <span className="mono font-bold text-palantir-green">{brl(b.net)}</span>
        </div>
      </div>
      <p className="mono mt-2 text-[10px] text-palantir-muted">
        preço ao cliente em ,00 ou ,99
        {wasRounded ? ` · arredondado de ${brl(rawFinal)}` : ""}
        {" · "}breakdown dinâmico
      </p>
    </div>
  );
}

function Line({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between">
      <span className="mono text-palantir-muted">{label}</span>
      <span className={`mono ${className}`}>{value}</span>
    </div>
  );
}
