"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, Check, Lock, ShoppingBag, ShieldCheck, X } from "lucide-react";
import { brl, cn } from "@/lib/utils";

interface Order {
  id: string;
  number: number;
  total: number;
  method: "pix" | "card";
  status: string;
  pdv_name: string;
  items: { id: string; name: string; qty: number; unit_price: number }[];
}

interface CepHint {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

type Step = "form" | "processing" | "pending" | "success" | "failed";

/* Marca — logo do Somma Club (arquivo em /public/somma-club.svg).
   Enquanto o arquivo não existir, exibe wordmark tipográfico como fallback. */
function Brand({ className }: { className?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span
        className={cn(
          "font-body font-bold tracking-[0.18em] text-somma-orange text-sm uppercase",
          className
        )}
      >
        Somma Club
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- logo em /public trocável; <img> evita config de SVG do next/image
    <img
      src="/somma-club.svg"
      alt="Somma Club"
      onError={() => setBroken(true)}
      className={cn("h-7 w-auto object-contain", className)}
    />
  );
}

export function PayLinkView({
  orderInitial,
  orderId,
}: {
  orderInitial: Order;
  orderId: string;
}) {
  const [order, setOrder] = useState<Order>(orderInitial);
  const [step, setStep] = useState<Step>(() =>
    orderInitial.status === "paid" ? "success" : "form"
  );
  const [error, setError] = useState<string | null>(null);

  const [card, setCard] = useState({
    holderName: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
  });
  const [holder, setHolder] = useState({
    email: "",
    postalCode: "",
    addressNumber: "",
    addressComplement: "",
    phone: "",
  });
  const [cepHint, setCepHint] = useState<CepHint | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  const refreshOrder = useCallback(async () => {
    try {
      const response = await fetch(`/api/pay/${orderId}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json().catch(() => ({}))) as { order?: Order };
      if (!data.order) return;
      setOrder(data.order);
      if (["paid", "preparing", "ready", "partial", "delivered"].includes(data.order.status)) {
        setStep("success");
      }
    } catch {
      // Uma falha transitória será recuperada na próxima consulta.
    }
  }, [orderId]);

  useEffect(() => {
    const poll = window.setInterval(() => void refreshOrder(), 3000);
    return () => window.clearInterval(poll);
  }, [refreshOrder]);

  const lookupCep = useCallback(async (raw: string) => {
    const cep = raw.replace(/\D/g, "");
    if (cep.length !== 8) {
      setCepHint(null);
      return;
    }
    setCepLoading(true);
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
      if (!r.ok) {
        setCepHint(null);
        return;
      }
      const data = await r.json();
      setCepHint({
        street: data.street,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
      });
    } catch {
      setCepHint(null);
    } finally {
      setCepLoading(false);
    }
  }, []);

  async function submit() {
    setError(null);
    setStep("processing");
    try {
      const response = await fetch(`/api/pay/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card: {
            holderName: card.holderName,
            number: card.number.replace(/\s/g, ""),
            expiryMonth: card.expiryMonth,
            expiryYear: card.expiryYear,
            ccv: card.ccv,
          },
          holder_info: {
            email: holder.email,
            postalCode: holder.postalCode.replace(/\D/g, ""),
            addressNumber: holder.addressNumber,
            addressComplement: holder.addressComplement || null,
            phone: holder.phone ? holder.phone.replace(/\D/g, "") : null,
          },
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Não foi possível concluir o pagamento");
        setStep("failed");
        return;
      }
      setStep(data.status === "paid" ? "success" : "pending");
    } catch {
      setError(
        "A resposta do pagamento não foi confirmada. Confira seu banco antes de tentar novamente."
      );
      setStep("failed");
    }
  }

  // ─── SUCESSO ───────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-dvh-100 flex flex-col items-center justify-center px-6 pt-safe pb-safe text-center bg-somma-bg somma-grain font-body">
        <Brand className="mb-10" />
        <div className="size-20 rounded-full bg-somma-green/15 ring-8 ring-somma-green/10 grid place-items-center mb-6 animate-fade-in">
          <Check className="size-10 text-somma-green" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Pagamento confirmado
        </h1>
        <p className="text-[13px] text-somma-muted mt-2 tabular-nums">Pedido #{order.number}</p>
        <p className="text-[15px] leading-relaxed text-somma-text mt-5 max-w-sm">
          Vá até o <span className="text-white font-semibold">{order.pdv_name}</span> e
          retire o seu pedido com o atendente — eles já receberam a confirmação.
        </p>
        <div className="mt-8 w-full max-w-sm rounded-2xl border border-somma-border bg-somma-surface p-5 text-left">
          {order.items.map((it) => (
            <div key={it.id} className="flex justify-between gap-3 text-[15px] py-1">
              <span className="text-somma-text">
                <span className="text-somma-orange font-semibold tabular-nums mr-1">{it.qty}×</span>
                {it.name}
              </span>
              <span className="text-somma-muted shrink-0 tabular-nums">
                {brl(it.qty * it.unit_price)}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-somma-border mt-3 pt-3 text-white font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{brl(order.total)}</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── PROCESSANDO ───────────────────────────────────────────
  if (step === "processing") {
    return (
      <div className="min-h-dvh-100 flex flex-col items-center justify-center p-8 pt-safe pb-safe bg-somma-bg somma-grain font-body text-center">
        <Brand className="mb-10" />
        <div className="size-14 mb-5 rounded-full border-4 border-somma-border border-t-somma-orange animate-spin" />
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Processando pagamento
        </h2>
        <p className="text-sm text-somma-muted mt-2 max-w-xs">
          Confirmando os dados com segurança. Isso leva alguns segundos.
        </p>
        <p className="text-[12px] text-somma-muted/60 mt-1">Não feche esta tela</p>
      </div>
    );
  }

  if (step === "pending") {
    return (
      <div
        className="min-h-dvh-100 flex flex-col items-center justify-center p-8 pt-safe pb-safe bg-somma-bg somma-grain font-body text-center"
        role="status"
        aria-live="polite"
      >
        <Brand className="mb-10" />
        <div className="size-14 mb-5 rounded-full border-4 border-somma-border border-t-somma-orange animate-spin" />
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Pagamento em análise
        </h2>
        <p className="text-sm text-somma-muted mt-2 max-w-xs">
          A operadora ainda não confirmou o cartão. Esta página atualizará automaticamente.
        </p>
        <p className="text-[12px] text-somma-muted/60 mt-2 tabular-nums">
          Pedido #{order.number}
        </p>
      </div>
    );
  }

  // ─── FALHA ─────────────────────────────────────────────────
  if (step === "failed") {
    return (
      <div className="min-h-dvh-100 flex flex-col items-center justify-center px-6 pt-safe pb-safe bg-somma-bg somma-grain font-body text-center">
        <Brand className="mb-10" />
        <div className="size-20 mb-6 rounded-full ring-8 ring-somma-red/10 bg-somma-red/10 grid place-items-center">
          <X className="size-10 text-somma-red" strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white max-w-sm">
          Pagamento não concluído
        </h2>
        {error && (
          <p
            role="alert"
            className="text-sm text-somma-text mt-4 border border-somma-red/25 bg-somma-red/5 px-4 py-3 rounded-xl max-w-sm"
          >
            {error}
          </p>
        )}
        <p className="text-[13px] text-somma-muted/80 mt-3 max-w-xs">
          Se houve falha de conexão, confira o app do banco antes de tentar novamente.
        </p>
        <button
          onClick={() => {
            setError(null);
            setStep("form");
          }}
          className="mt-7 w-full max-w-sm rounded-xl bg-somma-orange min-h-touch h-13 font-semibold text-white active:scale-[0.99] transition-transform focus-ring"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // ─── FORMULÁRIO ────────────────────────────────────────────
  const cardFilled =
    card.holderName.trim().length >= 2 &&
    card.number.replace(/\D/g, "").length >= 13 &&
    card.expiryMonth.length >= 1 &&
    card.expiryYear.length >= 2 &&
    card.ccv.length >= 3 &&
    holder.email.includes("@") &&
    holder.postalCode.replace(/\D/g, "").length === 8 &&
    holder.addressNumber.trim().length >= 1;

  // Resumo do pedido (DRY — mobile no topo, desktop na sidebar)
  const orderSummary = (
    <div className="rounded-2xl border border-somma-border bg-somma-surface p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingBag className="size-4 text-somma-orange" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-somma-muted">
          Resumo do pedido
        </p>
      </div>
      <ul className="space-y-2.5">
        {order.items.map((it) => (
          <li key={it.id} className="flex justify-between gap-3 text-[15px]">
            <span className="text-somma-text min-w-0">
              <span className="text-somma-orange font-semibold tabular-nums mr-1.5">
                {it.qty}×
              </span>
              {it.name}
            </span>
            <span className="text-somma-muted shrink-0 tabular-nums">
              {brl(it.qty * it.unit_price)}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-somma-border mt-4 pt-4 flex justify-between items-baseline">
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-somma-muted">
          Total
        </span>
        <span className="text-3xl font-bold tracking-tight text-white tabular-nums">
          {brl(order.total)}
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh-100 bg-somma-bg somma-grain text-white font-body">
      {/* Header — marca Somma Club */}
      <header className="sticky top-0 z-20 border-b border-somma-border bg-somma-bg/80 backdrop-blur pt-safe">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Brand />
          <p className="text-[11px] text-somma-muted uppercase tracking-[0.14em] hidden sm:inline-flex items-center gap-1.5">
            <Lock className="size-3" />
            Pagamento seguro · Asaas
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-7 lg:pt-10">
        {/* Hero */}
        <div className="text-center lg:text-left">
          <p className="text-[11px] font-semibold text-somma-orange tracking-[0.2em] uppercase tabular-nums">
            Pedido #{order.number}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-[1.05] mt-2 text-balance">
            {order.pdv_name}
          </h1>
        </div>

        {/* Mobile: resumo no topo, depois form. Desktop: grid 2 col */}
        <div className="mt-7 lg:mt-10 lg:grid lg:grid-cols-[1fr_400px] lg:gap-10 lg:items-start pb-36 lg:pb-16">
          {/* === FORM === */}
          <div className="space-y-5 order-2 lg:order-1">
            <div className="lg:hidden">{orderSummary}</div>

            {/* Cartão */}
            <section className="rounded-2xl border border-somma-border bg-somma-surface p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-somma-orange" />
                <p className="text-[11px] font-semibold text-somma-muted uppercase tracking-[0.16em]">
                  Dados do cartão
                </p>
              </div>
              <Input
                label="Número do cartão"
                value={formatCardNumber(card.number)}
                onChange={(v) => setCard({ ...card, number: v.replace(/\D/g, "").slice(0, 19) })}
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                autoComplete="cc-number"
              />
              <Input
                label="Nome impresso no cartão"
                value={card.holderName}
                onChange={(v) => setCard({ ...card, holderName: v })}
                placeholder="Como no cartão"
                autoCapitalize="characters"
                autoComplete="cc-name"
              />
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Mês"
                  value={card.expiryMonth}
                  onChange={(v) => setCard({ ...card, expiryMonth: v.replace(/\D/g, "").slice(0, 2) })}
                  placeholder="MM"
                  inputMode="numeric"
                  autoComplete="cc-exp-month"
                />
                <Input
                  label="Ano"
                  value={card.expiryYear}
                  onChange={(v) => setCard({ ...card, expiryYear: v.replace(/\D/g, "").slice(0, 4) })}
                  placeholder="AAAA"
                  inputMode="numeric"
                  autoComplete="cc-exp-year"
                />
                <Input
                  label="CVV"
                  value={card.ccv}
                  onChange={(v) => setCard({ ...card, ccv: v.replace(/\D/g, "").slice(0, 4) })}
                  placeholder="123"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                />
              </div>
            </section>

            {/* Titular */}
            <section className="rounded-2xl border border-somma-border bg-somma-surface p-5 space-y-4">
              <p className="text-[11px] font-semibold text-somma-muted uppercase tracking-[0.16em]">
                Dados do titular
              </p>
              <Input
                label="E-mail"
                value={holder.email}
                onChange={(v) => setHolder({ ...holder, email: v })}
                placeholder="seu@email.com"
                inputMode="email"
                autoComplete="email"
              />
              <div>
                <label className="block">
                  <span className="text-[12px] font-medium text-somma-muted flex items-center gap-2">
                    CEP
                    {cepLoading && (
                      <span className="text-[11px] text-somma-orange inline-flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" /> buscando...
                      </span>
                    )}
                    {cepHint && !cepLoading && (
                      <span className="text-[11px] text-somma-green inline-flex items-center gap-1">
                        <Check className="size-3" /> encontrado
                      </span>
                    )}
                  </span>
                  <input
                    value={maskCep(holder.postalCode)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                      setHolder({ ...holder, postalCode: raw });
                      if (raw.length === 8) void lookupCep(raw);
                      else setCepHint(null);
                    }}
                    inputMode="numeric"
                    placeholder="00000-000"
                    autoComplete="postal-code"
                    className="mt-1.5 w-full rounded-xl bg-somma-bg border border-somma-border px-4 min-h-touch h-13 text-white text-base outline-none transition-colors focus:border-somma-orange focus-ring placeholder:text-somma-muted/50"
                  />
                </label>
                {cepHint?.street && (
                  <p className="text-[12px] text-somma-muted mt-1.5">
                    {cepHint.street}
                    {cepHint.neighborhood ? ` · ${cepHint.neighborhood}` : ""} · {cepHint.city}/{cepHint.state}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Número *"
                  value={holder.addressNumber}
                  onChange={(v) => setHolder({ ...holder, addressNumber: v.slice(0, 20) })}
                  placeholder="123"
                  inputMode="numeric"
                />
                <Input
                  label="Complemento"
                  value={holder.addressComplement}
                  onChange={(v) => setHolder({ ...holder, addressComplement: v })}
                  placeholder="Apto 12"
                />
              </div>
              <Input
                label="Telefone (opcional)"
                value={maskPhone(holder.phone)}
                onChange={(v) => setHolder({ ...holder, phone: v.replace(/\D/g, "").slice(0, 11) })}
                placeholder="(00) 00000-0000"
                inputMode="numeric"
                autoComplete="tel"
              />
            </section>

            {/* CTA desktop */}
            <div className="hidden lg:block">
              <button
                onClick={submit}
                disabled={!cardFilled}
                className="w-full rounded-xl bg-somma-orange min-h-touch h-14 text-white font-semibold text-base active:scale-[0.99] transition-transform focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Pagar {brl(order.total)}
              </button>
              <p className="text-[11px] text-somma-muted text-center mt-3 inline-flex items-center justify-center gap-1.5 w-full">
                <Lock className="size-3" />
                Pagamento seguro processado pelo Asaas
              </p>
            </div>
          </div>

          {/* === SIDEBAR DESKTOP === */}
          <aside className="hidden lg:block order-1 lg:order-2 lg:sticky lg:top-24">
            {orderSummary}
            <div className="mt-4 rounded-2xl border border-somma-border/60 bg-somma-surface/40 p-5 space-y-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-somma-green" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                  Seguro
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-somma-muted">
                Seus dados de pagamento são criptografados e processados pelo Asaas,
                certificado PCI-DSS. A maFood não armazena seu cartão.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* CTA mobile — sticky bottom estilo app */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-somma-bg/95 backdrop-blur border-t border-somma-border pb-safe">
        <div className="mx-auto max-w-md px-4 pt-3 pb-3">
          <button
            onClick={submit}
            disabled={!cardFilled}
            className="w-full rounded-xl bg-somma-orange min-h-touch h-13 text-white font-semibold text-base active:scale-[0.98] transition-transform focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Pagar {brl(order.total)}
          </button>
          <p className="text-[11px] text-somma-muted text-center mt-2 inline-flex items-center justify-center gap-1 w-full">
            <Lock className="size-2.5" />
            Pagamento seguro · Asaas
          </p>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  autoCapitalize,
  autoComplete,
}: {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "email" | "tel";
  autoCapitalize?: "off" | "none" | "sentences" | "words" | "characters";
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-somma-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        className="mt-1.5 w-full rounded-xl bg-somma-bg border border-somma-border px-4 min-h-touch h-13 text-white text-base outline-none transition-colors focus:border-somma-orange focus-ring placeholder:text-somma-muted/50"
      />
    </label>
  );
}

function formatCardNumber(d: string) {
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
function maskCep(d: string) {
  const r = d.replace(/\D/g, "").slice(0, 8);
  if (r.length <= 5) return r;
  return `${r.slice(0, 5)}-${r.slice(5)}`;
}
function maskPhone(d: string) {
  const r = d.replace(/\D/g, "").slice(0, 11);
  if (r.length <= 2) return r;
  if (r.length <= 7) return `(${r.slice(0, 2)}) ${r.slice(2)}`;
  if (r.length <= 10) return `(${r.slice(0, 2)}) ${r.slice(2, 6)}-${r.slice(6)}`;
  return `(${r.slice(0, 2)}) ${r.slice(2, 7)}-${r.slice(7)}`;
}
