"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

/*
  Bootstrap do primeiro admin. Esta tela só é acessível enquanto
  `mafood.admins` estiver vazia — depois a rota redireciona para /admin/login.
*/
export function AdminSetupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Senhas não coincidem");
    if (password.length < 8) return setError("Senha mínima 8 caracteres");

    setLoading(true);
    try {
      const r = await fetch("/api/admin/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setLoading(false);
    }
  }

  return (
    <main className="theme-admin min-h-dvh-100 palantir-grid flex items-center justify-center p-4 sm:p-6 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        <div className="mb-4 rounded-admin border border-palantir-yellow/40 bg-palantir-yellow/10 p-4 flex items-start gap-3">
          <ShieldCheck className="size-5 text-palantir-yellow shrink-0 mt-0.5" />
          <div>
            <p className="mono text-[10px] tracking-[0.3em] text-palantir-yellow">SETUP INICIAL</p>
            <p className="text-sm text-palantir-text mt-1">
              Crie o primeiro administrador do backoffice. Essa tela trava sozinha após a primeira criação.
            </p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="rounded-admin border border-palantir-border bg-palantir-surface p-5 space-y-3"
        >
          <label className="block">
            <span className="mono text-[11px] text-palantir-muted">Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch h-11 text-white outline-none focus:border-palantir-blue focus-ring-admin"
            />
          </label>

          <label className="block">
            <span className="mono text-[11px] text-palantir-muted">E-mail</span>
            <input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch h-11 text-white outline-none focus:border-palantir-blue focus-ring-admin"
            />
          </label>

          <label className="block">
            <span className="mono text-[11px] text-palantir-muted">Senha (mínimo 8 caracteres)</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch h-11 text-white outline-none focus:border-palantir-blue focus-ring-admin"
            />
          </label>

          <label className="block">
            <span className="mono text-[11px] text-palantir-muted">Confirmar senha</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch h-11 text-white outline-none focus:border-palantir-blue focus-ring-admin"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="mono text-xs text-palantir-red border border-palantir-red/30 bg-palantir-red/10 px-3 py-2 rounded-admin"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-admin bg-palantir-blue min-h-touch h-12 text-white font-medium disabled:opacity-40 focus-ring-admin"
          >
            {loading ? "Criando..." : "Criar administrador"}
          </button>
        </form>
      </div>
    </main>
  );
}
