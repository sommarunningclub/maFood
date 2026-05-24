"use client";

import { useState } from "react";
import { breakdownFromFinal, finalFromNet } from "@/lib/pricing";
import { brl } from "@/lib/utils";

const RATES = { commissionPct: 15, gatewayPct: 3.6, taxPct: 0 };

type Mode = "final" | "net";

export function PriceEngine({ initial = 38 }: { initial?: number }) {
  const [mode, setMode] = useState<Mode>("final");
  const [input, setInput] = useState(initial);

  const final = mode === "final" ? input : finalFromNet(input, RATES);
  const b = breakdownFromFinal(final, RATES);

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
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(Number(e.target.value) || 0)}
          className="mono mt-1 w-full rounded-admin border border-palantir-border bg-palantir-surface px-3 py-2 text-base text-white"
        />
      </label>

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
        breakdown calculado dinamicamente · só o preço final é armazenado
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
