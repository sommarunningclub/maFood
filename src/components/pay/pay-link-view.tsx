"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/utils";

interface Order {
  id: string;
  number: number;
  customer_name: string;
  total: number;
  method: "pix" | "card";
  status: string;
  notes: string | null;
  pdv_name: string;
  items: { id: string; name: string; qty: number; unit_price: number }[];
}

interface CepHint {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

type Step = "form" | "processing" | "success" | "failed";

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

  // Realtime: status muda → atualiza UI (ex: cliente pagou e webhook confirmou)
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`pay-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "mafood", table: "orders", filter: `id=eq.${orderId}` },
        async () => {
          const r = await fetch(`/api/pay/${orderId}`);
          if (r.ok) {
            const d = await r.json();
            setOrder(d.order);
            if (d.order.status === "paid") setStep("success");
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orderId]);

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
    // Delay mínimo 5s (UX consistency)
    const minDelay = new Promise<void>((res) => setTimeout(res, 5000));
    const reqP = fetch(`/api/pay/${orderId}`, {
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
    const [r] = await Promise.all([reqP, minDelay]);
    const data = await r.json();
    if (!r.ok) {
      setError(data.error ?? "Não foi possível concluir o pagamento");
      setStep("failed");
      return;
    }
    setStep("success");
  }

  if (step === "success") {
    return (
      <div className="min-h-dvh-100 flex flex-col items-center justify-center px-6 pt-safe pb-safe text-center bg-somma-bg">
        <div className="size-20 rounded-full bg-somma-green/15 border-4 border-somma-green/30 grid place-items-center mb-5">
          <CheckCircle2 className="size-10 text-somma-green" />
        </div>
        <h1 className="text-fluid-2xl text-white font-display uppercase">
          Pagamento confirmado!
        </h1>
        <p className="num text-[11px] text-somma-muted mt-2">PEDIDO #{order.number}</p>
        <p className="text-somma-text text-sm mt-5 max-w-sm">
          Vá até o <span className="text-white font-medium">{order.pdv_name}</span> e
          retire o seu pedido com o atendente. Eles já receberam a confirmação.
        </p>
        <div className="mt-8 w-full max-w-sm rounded-client border border-somma-border bg-somma-surface p-4 text-left">
          {order.items.map((it) => (
            <div key={it.id} className="flex justify-between text-sm py-0.5">
              <span className="text-somma-text">
                <span className="num text-somma-orange">{it.qty}×</span> {it.name}
              </span>
              <span className="num text-somma-muted">{brl(it.qty * it.unit_price)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-somma-border mt-2 pt-2 text-white font-semibold">
            <span>Total</span>
            <span className="num">{brl(order.total)}</span>
          </div>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="min-h-dvh-100 flex items-center justify-center p-8 pt-safe pb-safe bg-somma-bg">
        <div className="text-center max-w-sm">
          <div className="size-14 mx-auto mb-4 rounded-full border-4 border-somma-border border-t-somma-orange animate-spin" />
          <h2 className="text-white font-display uppercase tracking-wide text-fluid-xl">
            Processando pagamento
          </h2>
          <p className="num text-xs text-somma-muted mt-2">
            Carregando dados do pagamento com segurança...
          </p>
          <p className="num text-[10px] text-somma-muted/60 mt-1">Não feche esta tela</p>
        </div>
      </div>
    );
  }

  if (step === "failed") {
    return (
      <div className="min-h-dvh-100 flex items-center justify-center p-6 pt-safe pb-safe bg-somma-bg">
        <div className="text-center max-w-sm w-full">
          <div className="size-20 mx-auto mb-5 rounded-full border-4 border-somma-red/40 bg-somma-red/10 grid place-items-center">
            <span className="text-4xl">✕</span>
          </div>
          <h2 className="text-white font-display uppercase tracking-wide text-fluid-2xl">
            Pagamento não foi concluído
          </h2>
          {error && (
            <p
              role="alert"
              className="num text-sm text-somma-muted mt-3 border border-somma-red/20 bg-somma-red/5 px-3 py-2 rounded-client"
            >
              {error}
            </p>
          )}
          <p className="num text-[11px] text-somma-muted/80 mt-3">
            Nenhum valor foi cobrado. Tente novamente com outro cartão.
          </p>
          <button
            onClick={() => {
              setError(null);
              setStep("form");
            }}
            className="mt-6 w-full rounded-client bg-somma-orange min-h-touch h-12 text-white font-display uppercase tracking-wide focus-ring"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const subtotal = order.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const cardFilled =
    card.holderName.trim().length >= 2 &&
    card.number.replace(/\D/g, "").length >= 13 &&
    card.expiryMonth.length >= 1 &&
    card.expiryYear.length >= 2 &&
    card.ccv.length >= 3 &&
    holder.email.includes("@") &&
    holder.postalCode.replace(/\D/g, "").length === 8 &&
    holder.addressNumber.trim().length >= 1;

  return (
    <div className="min-h-dvh-100 p-4 sm:p-5 pt-safe pb-32 bg-somma-bg somma-grain">
      <header className="text-center">
        <p className="num text-[11px] text-somma-orange tracking-[0.3em] uppercase">
          maFood · pagamento
        </p>
        <h1 className="text-fluid-2xl text-white font-display uppercase mt-2">
          {order.pdv_name}
        </h1>
        <p className="num text-[11px] text-somma-muted mt-1">
          Pedido #{order.number} · {order.customer_name}
        </p>
      </header>

      <section className="mt-6 rounded-client border border-somma-border bg-somma-surface p-4 max-w-md mx-auto">
        {order.items.map((it) => (
          <div key={it.id} className="flex justify-between text-sm py-0.5">
            <span className="text-somma-text">
              <span className="num text-somma-orange">{it.qty}×</span> {it.name}
            </span>
            <span className="num text-somma-muted">{brl(it.qty * it.unit_price)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-somma-border mt-2 pt-2 text-white font-semibold">
          <span>Total</span>
          <span className="num">{brl(order.total)}</span>
        </div>
      </section>

      <section className="mt-6 max-w-md mx-auto space-y-3">
        <div className="flex items-center gap-2 num text-[11px] text-somma-muted uppercase tracking-widest">
          <CreditCard className="size-4" />
          Dados do cartão
        </div>
        <Input
          label="Número do cartão"
          value={formatCardNumber(card.number)}
          onChange={(v) => setCard({ ...card, number: v.replace(/\D/g, "").slice(0, 19) })}
          placeholder="0000 0000 0000 0000"
          inputMode="numeric"
        />
        <Input
          label="Nome impresso"
          value={card.holderName}
          onChange={(v) => setCard({ ...card, holderName: v })}
          placeholder="COMO NO CARTÃO"
          autoCapitalize="characters"
        />
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Mês"
            value={card.expiryMonth}
            onChange={(v) => setCard({ ...card, expiryMonth: v.replace(/\D/g, "").slice(0, 2) })}
            placeholder="MM"
            inputMode="numeric"
          />
          <Input
            label="Ano"
            value={card.expiryYear}
            onChange={(v) => setCard({ ...card, expiryYear: v.replace(/\D/g, "").slice(0, 4) })}
            placeholder="AAAA"
            inputMode="numeric"
          />
          <Input
            label="CVV"
            value={card.ccv}
            onChange={(v) => setCard({ ...card, ccv: v.replace(/\D/g, "").slice(0, 4) })}
            placeholder="123"
            inputMode="numeric"
          />
        </div>
      </section>

      <section className="mt-6 max-w-md mx-auto space-y-3">
        <p className="num text-[11px] text-somma-muted uppercase tracking-widest">
          Dados do titular
        </p>
        <Input
          label="E-mail"
          value={holder.email}
          onChange={(v) => setHolder({ ...holder, email: v })}
          placeholder="seu@email.com"
          inputMode="email"
        />
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <Input
            label="CEP"
            value={maskCep(holder.postalCode)}
            onChange={(v) => {
              const raw = v.replace(/\D/g, "").slice(0, 8);
              setHolder({ ...holder, postalCode: raw });
              if (raw.length === 8) void lookupCep(raw);
              else setCepHint(null);
            }}
            placeholder="00000-000"
            inputMode="numeric"
          />
          <div className="num text-[10px] text-somma-muted pb-3 min-w-[60px]">
            {cepLoading ? "buscando..." : cepHint ? "✓" : ""}
          </div>
        </div>
        {cepHint?.street && (
          <p className="num text-[11px] text-somma-muted -mt-1">
            {cepHint.street}
            {cepHint.neighborhood ? ` · ${cepHint.neighborhood}` : ""} · {cepHint.city}/{cepHint.state}
          </p>
        )}
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
        />
      </section>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-somma-bg/95 backdrop-blur border-t border-somma-border pb-safe">
        <div className="mx-auto max-w-md p-3 sm:p-4">
          <button
            onClick={submit}
            disabled={!cardFilled}
            className="w-full inline-flex items-center justify-center gap-2 rounded-client bg-somma-orange min-h-touch h-13 text-white font-display uppercase tracking-wide active:scale-[0.98] transition-transform focus-ring disabled:opacity-40"
          >
            Pagar {brl(subtotal)}
          </button>
          <p className="num text-[9px] text-somma-muted text-center mt-2">
            Pagamento seguro processado pelo Asaas
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
}: {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "email" | "tel";
  autoCapitalize?: "off" | "none" | "sentences" | "words" | "characters";
}) {
  return (
    <label className="block">
      <span className="num text-[11px] text-somma-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        className="mt-1 w-full rounded-client bg-somma-surface border border-somma-border px-3 min-h-touch h-12 text-white text-sm outline-none focus:border-somma-orange focus-ring"
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
