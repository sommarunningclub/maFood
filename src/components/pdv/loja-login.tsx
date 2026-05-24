"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface PdvLoginInfo {
  slug: string;
  name: string;
  logo_url: string;
  category: string | null;
  instagram_handle: string | null;
  pin_set_at: string | null;
}

export function LojaLogin({ pdv, next }: { pdv: PdvLoginInfo; next?: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noPin = !pdv.pin_set_at;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/pdv/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: pdv.slug, pin }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro");
      router.push(next && next.startsWith("/loja") ? next : `/loja/${pdv.slug}/pedidos`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="theme-admin min-h-screen palantir-grid flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Cartão de identidade do PDV */}
        <div className="mb-4 rounded-admin border border-palantir-border bg-palantir-surface p-5 text-center">
          <div className="text-5xl mb-2">{pdv.logo_url || "🍽"}</div>
          <h1 className="text-xl font-semibold text-white">{pdv.name}</h1>
          {pdv.category && (
            <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted mt-1">
              {pdv.category}
            </p>
          )}
          {pdv.instagram_handle && (
            <a
              href={`https://instagram.com/${pdv.instagram_handle}`}
              target="_blank"
              rel="noreferrer"
              className="mono mt-2 inline-block text-[10px] text-palantir-blue hover:underline"
            >
              @{pdv.instagram_handle}
            </a>
          )}
        </div>

        <form
          onSubmit={submit}
          className="rounded-admin border border-palantir-border bg-palantir-surface p-5"
        >
          <p className="mono text-[10px] tracking-[0.3em] text-palantir-muted mb-1">
            PAINEL OPERACIONAL
          </p>
          <h2 className="text-lg font-semibold text-white mb-4">Entrar com PIN</h2>

          {noPin ? (
            <div className="mb-3 rounded-admin border border-palantir-yellow/40 bg-palantir-yellow/10 px-3 py-2">
              <p className="mono text-[11px] text-palantir-yellow">
                ⚠ PIN ainda não foi definido. Solicite ao administrador do evento.
              </p>
            </div>
          ) : (
            <label className="block mb-3">
              <span className="mono text-[11px] text-palantir-muted">PIN</span>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={8}
                minLength={4}
                required
                autoFocus
                autoComplete="current-password"
                className="mono mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 py-3 text-3xl tracking-[0.5em] text-center text-white outline-none focus:border-palantir-blue"
              />
            </label>
          )}

          {error && (
            <p className="mono text-xs text-palantir-red mb-3 border border-palantir-red/30 bg-palantir-red/10 px-3 py-2 rounded-admin">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || noPin || pin.length < 4}
            className="w-full rounded-admin bg-palantir-blue h-11 text-white font-medium disabled:opacity-40"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mono text-[10px] text-palantir-muted mt-4 text-center">
          maFood · {pdv.slug}
        </p>
      </div>
    </div>
  );
}
