"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn } from "lucide-react";

export function AdminLoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro");
      router.push(next && next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setLoading(false);
    }
  }

  return (
    <main className="theme-admin min-h-dvh-100 palantir-grid flex items-center justify-center p-4 sm:p-6 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        <div className="mb-4 rounded-admin border border-palantir-border bg-palantir-surface p-5 text-center">
          <p className="mono text-[10px] tracking-[0.3em] text-palantir-muted">MAFOOD</p>
          <h1 className="text-xl font-semibold text-white mt-1">Backoffice</h1>
          <p className="mono text-[11px] text-palantir-muted mt-1">acesso administrativo</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-admin border border-palantir-border bg-palantir-surface p-5"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Entrar</h2>

          <label className="block mb-3">
            <span className="mono text-[11px] text-palantir-muted">E-mail</span>
            <input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch h-11 text-white outline-none focus:border-palantir-blue focus-ring-admin"
            />
          </label>

          <label className="block mb-3">
            <span className="mono text-[11px] text-palantir-muted">Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch h-11 text-white outline-none focus:border-palantir-blue focus-ring-admin"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="mono text-xs text-palantir-red mb-3 border border-palantir-red/30 bg-palantir-red/10 px-3 py-2 rounded-admin"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full inline-flex items-center justify-center gap-2 rounded-admin bg-palantir-blue min-h-touch h-12 text-white font-medium disabled:opacity-40 focus-ring-admin"
          >
            {loading ? "Entrando..." : <><LogIn className="size-4" /> Entrar</>}
          </button>
        </form>

        <p className="mono text-[10px] text-palantir-muted mt-4 text-center">
          maFood · backoffice
        </p>
      </div>
    </main>
  );
}
