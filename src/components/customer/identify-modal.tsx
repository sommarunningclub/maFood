"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Stage = "cpf" | "vip_prefill" | "new" | "loading";

interface Prefill {
  cpf: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  lista_vip_id?: string | null;
}

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function IdentifyModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [stage, setStage] = useState<Stage>("cpf");
  const [cpf, setCpf] = useState("");
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setStage("cpf");
      setCpf("");
      setPrefill(null);
      setName("");
      setEmail("");
      setPhone("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function submitCpf(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStage("loading");
    const r = await fetch("/api/customer/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf }),
    });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error ?? "Erro");
      setStage("cpf");
      return;
    }
    if (data.status === "existing") {
      onSuccess();
      return;
    }
    setPrefill(data.prefill ?? { cpf });
    setName(data.prefill?.name ?? "");
    setEmail(data.prefill?.email ?? "");
    setPhone(data.prefill?.phone ? maskPhone(data.prefill.phone) : "");
    setStage(data.status === "vip_match" ? "vip_prefill" : "new");
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStage("loading");
    const r = await fetch("/api/customer/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cpf,
        name,
        email,
        phone: phone.replace(/\D/g, ""),
        lista_vip_id: prefill?.lista_vip_id ?? null,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error ?? "Erro");
      setStage(prefill?.lista_vip_id ? "vip_prefill" : "new");
      return;
    }
    onSuccess();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="identify-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-mafood-md border border-mafood-border bg-mafood-surface-strong p-5 pb-safe shadow-2xl animate-in slide-in-from-bottom"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2
              id="identify-title"
              className="mafood-display text-mafood-text-primary text-lg"
            >
              {stage === "vip_prefill"
                ? "Bem-vindo de volta!"
                : stage === "new"
                ? "Primeiro acesso"
                : "Identifique-se"}
            </h2>
            <p className="text-mafood-text-secondary text-xs mt-1">
              {stage === "cpf" || stage === "loading"
                ? "Para finalizar o pedido precisamos do seu CPF."
                : stage === "vip_prefill"
                ? "Encontramos seus dados na lista. Confirme para continuar."
                : "Complete o cadastro para finalizar o pedido."}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-touch -mt-1 -mr-2 place-items-center text-mafood-text-secondary hover:text-mafood-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
          >
            <X className="size-5" />
          </button>
        </div>

        {stage === "cpf" && (
          <form onSubmit={submitCpf}>
            <label className="block">
              <span className="num text-[11px] text-mafood-text-secondary">CPF</span>
              <input
                value={maskCpf(cpf)}
                onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="000.000.000-00"
                autoFocus
                required
                className="num mt-1 w-full rounded-mafood-md bg-mafood-background border border-mafood-border px-3 min-h-touch h-12 text-xl tracking-wider text-mafood-text-primary outline-none focus:border-mafood-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
              />
            </label>
            {error && <p className="num text-xs text-mafood-accent-dark mt-2">{error}</p>}
            <button
              type="submit"
              disabled={cpf.length !== 11}
              className="mt-4 w-full rounded-mafood-md bg-mafood-primary min-h-touch h-12 text-white font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
            >
              Continuar
            </button>
          </form>
        )}

        {stage === "vip_prefill" && prefill && (
          <form onSubmit={submitRegister}>
            <div className="flex items-center gap-2 mb-3">
              <span className="num text-[10px] uppercase bg-mafood-primary/15 text-mafood-primary px-2 py-1 rounded">
                ✓ Lista VIP
              </span>
            </div>
            <PrefillFields
              cpf={cpf}
              name={name} setName={setName}
              email={email} setEmail={setEmail}
              phone={phone} setPhone={setPhone}
            />
            {error && <p className="num text-xs text-mafood-accent-dark mt-2">{error}</p>}
            <button
              type="submit"
              disabled={!name.trim()}
              className="mt-4 w-full rounded-mafood-md bg-mafood-primary min-h-touch h-12 text-white font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
            >
              Confirmar e continuar
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("cpf");
                setPrefill(null);
                setName("");
                setEmail("");
                setPhone("");
              }}
              className="mt-2 w-full num text-xs text-mafood-text-secondary min-h-touch focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
            >
              ← Usar outro CPF
            </button>
          </form>
        )}

        {stage === "new" && prefill && (
          <form onSubmit={submitRegister}>
            <PrefillFields
              cpf={cpf}
              name={name} setName={setName}
              email={email} setEmail={setEmail}
              phone={phone} setPhone={setPhone}
            />
            {error && <p className="num text-xs text-mafood-accent-dark mt-2">{error}</p>}
            <button
              type="submit"
              disabled={!name.trim()}
              className="mt-4 w-full rounded-mafood-md bg-mafood-primary min-h-touch h-12 text-white font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
            >
              Criar cadastro e continuar
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("cpf");
                setPrefill(null);
                setName("");
                setEmail("");
                setPhone("");
              }}
              className="mt-2 w-full num text-xs text-mafood-text-secondary min-h-touch focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
            >
              ← Usar outro CPF
            </button>
          </form>
        )}

        {stage === "loading" && (
          <div className="py-8 text-center">
            <div className="size-8 mx-auto mb-2 rounded-full border-2 border-mafood-border border-t-mafood-primary animate-spin" />
            <p className="num text-sm text-mafood-text-secondary">Aguarde...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PrefillFields({
  cpf,
  name, setName,
  email, setEmail,
  phone, setPhone,
}: {
  cpf: string;
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="num text-[11px] text-mafood-text-secondary">CPF</span>
        <input
          value={maskCpf(cpf)}
          disabled
          className="num mt-1 w-full rounded-mafood-md bg-mafood-background border border-mafood-border px-3 min-h-touch h-11 text-mafood-text-primary opacity-60"
        />
      </label>
      <label className="block">
        <span className="num text-[11px] text-mafood-text-secondary">Nome completo *</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          className="mt-1 w-full rounded-mafood-md bg-mafood-background border border-mafood-border px-3 min-h-touch h-11 text-mafood-text-primary outline-none focus:border-mafood-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
        />
      </label>
      <label className="block">
        <span className="num text-[11px] text-mafood-text-secondary">E-mail (opcional)</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-mafood-md bg-mafood-background border border-mafood-border px-3 min-h-touch h-11 text-mafood-text-primary outline-none focus:border-mafood-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
        />
      </label>
      <label className="block">
        <span className="num text-[11px] text-mafood-text-secondary">Telefone (opcional)</span>
        <input
          value={phone}
          onChange={(e) => setPhone(maskPhone(e.target.value))}
          inputMode="numeric"
          placeholder="(00) 00000-0000"
          className="num mt-1 w-full rounded-mafood-md bg-mafood-background border border-mafood-border px-3 min-h-touch h-11 text-mafood-text-primary outline-none focus:border-mafood-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
        />
      </label>
    </div>
  );
}
