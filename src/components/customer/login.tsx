"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function CustomerLogin({
  venue,
  venueName,
  next,
}: {
  venue: string;
  venueName: string;
  venueDescription?: string;
  next?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("cpf");
  const [cpf, setCpf] = useState("");
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [cepHint, setCepHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function nextUrl() {
    return next && next.startsWith(`/${venue}`) ? next : `/${venue}`;
  }

  function resetToCpf() {
    setStage("cpf");
    setPrefill(null);
    setName("");
    setEmail("");
    setPhone("");
    setPostalCode("");
    setAddressNumber("");
    setAddressComplement("");
    setCepHint(null);
  }

  async function lookupCep(raw: string) {
    const cep = raw.replace(/\D/g, "");
    if (cep.length !== 8) {
      setCepHint(null);
      return;
    }
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
      if (!r.ok) {
        setCepHint(null);
        return;
      }
      const data = await r.json();
      setCepHint(
        [data.street, data.neighborhood, data.city && `${data.city}/${data.state}`]
          .filter(Boolean)
          .join(" · ") || null
      );
    } catch {
      setCepHint(null);
    }
  }

  const profileReady =
    name.trim().length >= 2 &&
    email.includes("@") &&
    phone.replace(/\D/g, "").length >= 10 &&
    postalCode.replace(/\D/g, "").length === 8 &&
    addressNumber.trim().length >= 1;

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
      router.push(nextUrl());
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
        postal_code: postalCode.replace(/\D/g, ""),
        address_number: addressNumber.trim(),
        address_complement: addressComplement.trim() || null,
        lista_vip_id: prefill?.lista_vip_id ?? null,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error ?? "Erro");
      setStage(prefill?.lista_vip_id ? "vip_prefill" : "new");
      return;
    }
    router.push(nextUrl());
  }

  return (
    <main className="min-h-dvh-100 flex flex-col items-center justify-center px-4 sm:px-5 py-10 pt-safe pb-safe">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <p className="num text-[11px] text-mafood-primary-strong tracking-[0.25em] mb-2">
            SOMMAFOOD
          </p>
          <h1 className="mafood-display text-fluid-3xl leading-[0.95] text-mafood-text-primary text-balance">
            {venueName}
          </h1>
        </header>

        {stage === "cpf" && (
          <form
            onSubmit={submitCpf}
            className="rounded-mafood-md border border-mafood-border bg-mafood-surface-strong p-5"
          >
            <h2 className="mafood-display text-mafood-text-primary text-lg mb-1">
              Identifique-se
            </h2>
            <p className="text-mafood-text-secondary text-sm mb-4">
              Use seu CPF para acessar a praça de alimentação.
            </p>
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
              disabled={cpf.replace(/\D/g, "").length !== 11}
              className="mt-4 w-full rounded-mafood-md bg-mafood-primary-strong min-h-touch h-12 text-white font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
            >
              Continuar
            </button>
          </form>
        )}

        {(stage === "vip_prefill" || stage === "new") && prefill && (
          <form
            onSubmit={submitRegister}
            className={`rounded-mafood-md border bg-mafood-surface-strong p-5 ${
              stage === "vip_prefill" ? "border-mafood-primary/40" : "border-mafood-border"
            }`}
          >
            {stage === "vip_prefill" && (
              <div className="flex items-center gap-2 mb-3">
                <span className="num text-[10px] uppercase bg-mafood-primary/15 text-mafood-primary-strong px-2 py-1 rounded">
                  ✓ Lista VIP
                </span>
              </div>
            )}
            <h2 className="mafood-display text-mafood-text-primary text-lg mb-1">
              {stage === "vip_prefill" ? "Bem-vindo de volta!" : "Primeiro acesso"}
            </h2>
            <p className="text-mafood-text-secondary text-sm mb-4">
              {stage === "vip_prefill"
                ? "Confirme seus dados. No pagamento, só o cartão."
                : "Cadastro completo — depois o pagamento fica só com o cartão."}
            </p>
            <PrefillFields
              cpf={cpf}
              name={name}
              setName={setName}
              email={email}
              setEmail={setEmail}
              phone={phone}
              setPhone={setPhone}
              postalCode={postalCode}
              setPostalCode={(v) => {
                const raw = v.replace(/\D/g, "").slice(0, 8);
                setPostalCode(raw);
                if (raw.length === 8) void lookupCep(raw);
                else setCepHint(null);
              }}
              addressNumber={addressNumber}
              setAddressNumber={setAddressNumber}
              addressComplement={addressComplement}
              setAddressComplement={setAddressComplement}
              cepHint={cepHint}
            />
            {error && <p className="num text-xs text-mafood-accent-dark mt-2">{error}</p>}
            <button
              type="submit"
              disabled={!profileReady}
              className="mt-4 w-full rounded-mafood-md bg-mafood-primary-strong min-h-touch h-12 text-white font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
            >
              {stage === "vip_prefill" ? "Entrar no evento" : "Criar cadastro e entrar"}
            </button>
            <button
              type="button"
              onClick={resetToCpf}
              className="mt-2 w-full num text-xs text-mafood-text-secondary min-h-touch focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
            >
              ← Usar outro CPF
            </button>
          </form>
        )}

        {stage === "loading" && (
          <div className="rounded-mafood-md border border-mafood-border bg-mafood-surface-strong p-8 text-center">
            <p className="num text-sm text-mafood-text-secondary">Aguarde...</p>
          </div>
        )}
      </div>
    </main>
  );
}

function PrefillFields({
  cpf,
  name,
  setName,
  email,
  setEmail,
  phone,
  setPhone,
  postalCode,
  setPostalCode,
  addressNumber,
  setAddressNumber,
  addressComplement,
  setAddressComplement,
  cepHint,
}: {
  cpf: string;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  postalCode: string;
  setPostalCode: (v: string) => void;
  addressNumber: string;
  setAddressNumber: (v: string) => void;
  addressComplement: string;
  setAddressComplement: (v: string) => void;
  cepHint: string | null;
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
          autoComplete="name"
          className="mt-1 w-full rounded-mafood-md bg-mafood-background border border-mafood-border px-3 min-h-touch h-11 text-mafood-text-primary outline-none focus:border-mafood-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
        />
      </label>
      <label className="block">
        <span className="num text-[11px] text-mafood-text-secondary">E-mail *</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="mt-1 w-full rounded-mafood-md bg-mafood-background border border-mafood-border px-3 min-h-touch h-11 text-mafood-text-primary outline-none focus:border-mafood-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
        />
      </label>
      <label className="block">
        <span className="num text-[11px] text-mafood-text-secondary">Telefone *</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(maskPhone(e.target.value))}
          inputMode="tel"
          placeholder="(00) 00000-0000"
          required
          autoComplete="tel"
          className="num mt-1 w-full rounded-mafood-md bg-mafood-background border border-mafood-border px-3 min-h-touch h-11 text-mafood-text-primary outline-none focus:border-mafood-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
        />
      </label>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="block">
          <span className="num text-[11px] text-mafood-text-secondary">CEP *</span>
          <input
            value={maskCep(postalCode)}
            onChange={(e) => setPostalCode(e.target.value)}
            inputMode="numeric"
            placeholder="00000-000"
            required
            autoComplete="postal-code"
            className="num mt-1 w-full rounded-mafood-md bg-mafood-background border border-mafood-border px-3 min-h-touch h-11 text-mafood-text-primary outline-none focus:border-mafood-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
          />
        </label>
        <label className="block">
          <span className="num text-[11px] text-mafood-text-secondary">Nº *</span>
          <input
            value={addressNumber}
            onChange={(e) => setAddressNumber(e.target.value.slice(0, 20))}
            inputMode="numeric"
            placeholder="123"
            required
            className="mt-1 w-full rounded-mafood-md bg-mafood-background border border-mafood-border px-3 min-h-touch h-11 text-mafood-text-primary outline-none focus:border-mafood-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
          />
        </label>
      </div>
      {cepHint && (
        <p className="num text-[11px] text-mafood-text-secondary -mt-1">{cepHint}</p>
      )}
      <label className="block">
        <span className="num text-[11px] text-mafood-text-secondary">Complemento</span>
        <input
          value={addressComplement}
          onChange={(e) => setAddressComplement(e.target.value)}
          placeholder="Apto, bloco… (opcional)"
          className="mt-1 w-full rounded-mafood-md bg-mafood-background border border-mafood-border px-3 min-h-touch h-11 text-mafood-text-primary outline-none focus:border-mafood-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
        />
      </label>
    </div>
  );
}
