"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PdvLoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/pdv/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug.trim().toLowerCase(), pin }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro");
      router.push(next && next.startsWith("/pdv") ? next : `/pdv/${data.pdv_slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-admin border border-palantir-border bg-palantir-surface p-6"
    >
      <p className="mono text-[11px] tracking-[0.3em] text-palantir-muted mb-1">
        MAFOOD · PDV
      </p>
      <h1 className="text-2xl font-semibold text-white mb-6">Acesso operacional</h1>

      <label className="block mb-3">
        <span className="mono text-[11px] text-palantir-muted">PDV (slug)</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="smash-house"
          autoComplete="username"
          required
          className="mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 text-white outline-none focus:border-palantir-blue"
        />
      </label>

      <label className="block mb-4">
        <span className="mono text-[11px] text-palantir-muted">PIN</span>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          maxLength={8}
          minLength={4}
          required
          autoComplete="current-password"
          className="mono mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 text-2xl tracking-[0.5em] text-white outline-none focus:border-palantir-blue"
        />
      </label>

      {error && (
        <p className="mono text-xs text-palantir-red mb-3 border border-palantir-red/30 bg-palantir-red/10 px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !slug || pin.length < 4}
        className="w-full rounded-admin bg-palantir-blue h-11 text-white font-medium disabled:opacity-40"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <p className="mono text-[10px] text-palantir-muted mt-4 text-center">
        Sem PIN? Solicite ao administrador do evento.
      </p>
    </form>
  );
}
