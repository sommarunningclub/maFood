"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { PeepsCanvas } from "./peeps-canvas";

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function LandingLogin() {
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerUrl, setRegisterUrl] = useState<string | null>(null);
  const digits = cpf.replace(/\D/g, "");
  const valid = digits.length === 11;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/landing/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: digits }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro");
      if (data.status === "new" && data.registerUrl) {
        setRegisterUrl(data.registerUrl);
        setLoading(false);
        return;
      }
      // Hard nav: cookie httpOnly acabou de ser setado; soft push pode travar.
      window.location.assign(data.next ?? "/somma-special-day");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setLoading(false);
    }
  }

  return (
    <main className="theme-client relative min-h-dvh-100 overflow-hidden bg-somma-bg text-somma-text">
      {/* Canvas de fundo — "Open Peeps" caminhando */}
      <PeepsCanvas className="pointer-events-none absolute inset-0 size-full opacity-60" />

      {/* Vinheta sutil pra dar leitura ao card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-somma-bg/85 via-somma-bg/55 to-somma-bg/95"
      />

      {/* Conteúdo */}
      <div className="relative z-10 flex min-h-dvh-100 flex-col items-center justify-center px-5 py-10 pt-safe pb-safe">
        <header className="mb-8 text-center max-w-md">
          <p className="num text-[11px] text-somma-orange tracking-[0.32em] mb-3">
            18 JUL 2026 · COPMDF · BRASÍLIA
          </p>
          <h1 className="text-fluid-4xl leading-[0.92] text-white font-display uppercase text-balance">
            Somma Special Day
          </h1>
          <p className="text-somma-muted text-sm mt-3 text-pretty">
            Praça de alimentação digital · Somma Special Day
          </p>
        </header>

        <form
          onSubmit={submit}
          className="w-full max-w-sm rounded-client border border-somma-border bg-somma-surface/85 backdrop-blur-md p-5 shadow-2xl shadow-black/40"
        >
          <h2 className="text-white font-display uppercase tracking-wide text-lg mb-1">
            Identifique-se
          </h2>
          <p className="text-somma-muted text-sm mb-4">
            Use seu CPF para entrar ou criar um novo cadastro.
          </p>

          <label className="block">
            <span className="num text-[11px] text-somma-muted">CPF</span>
            <input
              value={maskCpf(cpf)}
              onChange={(e) => {
                setCpf(e.target.value);
                setRegisterUrl(null);
                setError(null);
              }}
              inputMode="numeric"
              placeholder="000.000.000-00"
              autoFocus
              required
              className="num mt-1 w-full rounded-client bg-somma-bg/80 border border-somma-border px-3 min-h-touch h-12 text-xl tracking-wider text-white outline-none focus:border-somma-orange focus-ring"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="num text-xs text-somma-red mt-3 border border-somma-red/30 bg-somma-red/10 px-3 py-2 rounded-client"
            >
              {error}
            </p>
          )}

          {registerUrl ? (
            <div className="mt-4 rounded-client border border-somma-orange/50 bg-somma-orange/10 p-3">
              <p className="text-sm font-medium text-white">CPF ainda não cadastrado</p>
              <p className="mt-1 text-xs text-somma-muted">
                Crie seu usuário para acessar a praça e acompanhar os pedidos.
              </p>
              <button
                type="button"
                onClick={() => window.location.assign(registerUrl)}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-client bg-somma-orange min-h-touch h-12 text-white font-display uppercase tracking-wide focus-ring active:scale-[0.98] transition-transform"
              >
                Criar cadastro
                <ArrowRight className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={!valid || loading}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-client bg-somma-orange min-h-touch h-12 text-white font-display uppercase tracking-wide disabled:opacity-40 focus-ring active:scale-[0.98] transition-transform"
            >
              {loading ? "Entrando..." : "Entrar"}
              {!loading && <ArrowRight className="size-4" />}
            </button>
          )}

          <p className="num text-[10px] text-somma-muted/80 text-center mt-4">
            CPF novo? A opção de cadastro aparece automaticamente.
          </p>
        </form>

        <footer className="num text-[10px] text-somma-muted/60 mt-8 tracking-widest uppercase">
          maFood · Somma Running Club
        </footer>
      </div>
    </main>
  );
}
