"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft } from "lucide-react";
import { useCart } from "@/stores/cart-store";
import { brl } from "@/lib/utils";
import { IdentifyModal } from "@/components/customer/identify-modal";

type Step = "form" | "pix" | "card" | "submitting";
type PaymentMethod = "pix" | "card";

export function CheckoutView({
  venue,
  initialHasSession,
}: {
  venue: string;
  initialHasSession: boolean;
}) {
  const router = useRouter();
  const { items, pdvId, total, clear } = useCart();
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [step, setStep] = useState<Step>("form");
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [finalTotal, setFinalTotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [hasSession, setHasSession] = useState(initialHasSession);
  const [identifyOpen, setIdentifyOpen] = useState(false);

  const subtotal = total();
  const empty = items.length === 0;

  function handleSubmitClick() {
    if (!hasSession) {
      setIdentifyOpen(true);
      return;
    }
    void submitOrder();
  }

  async function submitOrder(): Promise<{ ok: boolean }> {
    setError(null);
    setStep("submitting");
    if (!pdvId) {
      setError("Carrinho inválido");
      setStep("form");
      return { ok: false };
    }
    const r = await fetch("/api/customer/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdv_id: pdvId,
        method,
        notes: notes || null,
        coupon_code: code.trim() || null,
        items: items.map((i) => ({ product_id: i.product.id, qty: i.qty, notes: i.notes })),
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error ?? "Erro ao criar pedido");
      setStep("form");
      return { ok: false };
    }
    setOrderNumber(data.order_number);
    setOrderId(data.order_id);
    setFinalTotal(Number(data.total));
    setDiscount(Number(data.discount));
    if (method === "pix") {
      const url = await QRCode.toDataURL(data.pix_payload, { width: 240, margin: 1 });
      setQr(url);
      setStep("pix");
    } else {
      setStep("card");
    }
    return { ok: true };
  }

  function finalize() {
    clear();
    router.push(`/${venue}/order/${orderId}`);
  }

  if (empty && step === "form") {
    return (
      <div className="min-h-dvh-100 flex flex-col items-center justify-center gap-4 p-8 text-center somma-grain pt-safe pb-safe">
        <p className="text-6xl">🛒</p>
        <p className="text-somma-muted">Seu carrinho está vazio</p>
        <Link
          href={`/${venue}`}
          className="rounded-client bg-somma-orange px-5 min-h-touch h-12 inline-flex items-center text-white font-display uppercase tracking-wide focus-ring"
        >
          Ver praça
        </Link>
      </div>
    );
  }

  if (step === "pix") {
    return (
      <div className="min-h-dvh-100 p-4 sm:p-5 pt-safe pb-safe somma-grain">
        <Header venue={venue} title="Pagamento Pix" />
        <div className="mt-6 flex flex-col items-center text-center">
          <p className="num text-[11px] text-somma-muted">PEDIDO #{orderNumber}</p>
          <PixTimer />
          <div className="bg-white p-3 rounded-client mt-4">
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR Code Pix" width={240} height={240} />
            )}
          </div>
          <p className="num text-fluid-2xl text-white mt-4">{brl(finalTotal)}</p>
          {discount > 0 && (
            <p className="num text-xs text-somma-green mt-1">
              − {brl(discount)} de desconto aplicado
            </p>
          )}
          <p className="text-somma-muted text-sm mt-1">Escaneie no app do seu banco</p>
          <button
            onClick={finalize}
            className="mt-8 w-full max-w-xs rounded-client bg-somma-green/90 min-h-touch h-12 text-black font-display uppercase tracking-wide focus-ring"
          >
            Já paguei
          </button>
          <p className="num text-[10px] text-somma-muted mt-3">
            (simulado · em produção: webhook Asaas confirma)
          </p>
        </div>
      </div>
    );
  }

  if (step === "card") {
    return (
      <div className="min-h-dvh-100 p-4 sm:p-5 pt-safe pb-safe somma-grain">
        <Header venue={venue} title="Cartão de crédito" />
        <p className="num text-[11px] text-somma-muted mt-2">PEDIDO #{orderNumber}</p>
        <div className="mt-4 space-y-3">
          <Input label="Número do cartão" placeholder="0000 0000 0000 0000" inputMode="numeric" />
          <Input label="Nome impresso" placeholder="COMO NO CARTÃO" autoCapitalize="characters" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Validade" placeholder="MM/AA" inputMode="numeric" />
            <Input label="CVV" placeholder="123" inputMode="numeric" />
          </div>
          <button
            onClick={finalize}
            className="mt-4 w-full rounded-client bg-somma-orange min-h-touch h-12 text-white font-display uppercase tracking-wide focus-ring"
          >
            Pagar {brl(finalTotal)}
          </button>
          <p className="num text-[10px] text-somma-muted text-center">(simulado nesta fase)</p>
        </div>
      </div>
    );
  }

  if (step === "submitting") {
    return (
      <div className="min-h-dvh-100 flex items-center justify-center p-8 somma-grain pt-safe pb-safe">
        <div className="text-center">
          <div className="size-10 mx-auto mb-3 rounded-full border-2 border-somma-border border-t-somma-orange animate-spin" />
          <p className="num text-sm text-somma-muted">Processando pedido...</p>
        </div>
      </div>
    );
  }

  // ── Form
  return (
    <div className="min-h-dvh-100 pb-32 p-4 sm:p-5 pt-safe somma-grain">
      <Header venue={venue} title="Checkout" />

      <section className="mt-5 rounded-client border border-somma-border bg-somma-surface p-4">
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.product.id} className="flex justify-between text-sm gap-3">
              <span className="text-somma-text min-w-0 truncate">
                <span className="num text-somma-orange">{i.qty}×</span> {i.product.name}
              </span>
              <span className="num text-somma-muted shrink-0">
                {brl(i.qty * i.product.price)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-3">
        <Input
          label="Observações"
          value={notes}
          onChange={setNotes}
          placeholder="Ex.: sem cebola, ponto da carne…"
        />
      </section>

      <section className="mt-4">
        <label className="block">
          <span className="num text-[11px] text-somma-muted">Cupom de desconto</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="OPCIONAL"
            autoCapitalize="characters"
            autoCorrect="off"
            className="mt-1 w-full rounded-client bg-somma-surface border border-somma-border px-3 min-h-touch h-12 text-white text-sm uppercase focus:border-somma-orange outline-none focus-ring"
          />
        </label>
      </section>

      <section className="mt-5">
        <p className="num text-[11px] text-somma-muted mb-2">Pagamento</p>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Método de pagamento">
          {(["pix", "card"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              role="radio"
              aria-checked={method === m}
              className={`rounded-client border min-h-touch h-12 num text-sm uppercase transition-colors focus-ring ${
                method === m
                  ? "border-somma-orange bg-somma-orange/10 text-somma-orange"
                  : "border-somma-border text-somma-muted"
              }`}
            >
              {m === "pix" ? "Pix" : "Cartão"}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5 border-t border-somma-border pt-4 space-y-1 num text-sm">
        <div className="flex justify-between text-white text-lg font-semibold">
          <span>Total</span>
          <span>{brl(subtotal)}</span>
        </div>
        <p className="num text-[10px] text-somma-muted">
          Cupom (se houver) será aplicado no servidor antes de gerar o Pix.
        </p>
      </section>

      {error && (
        <p
          role="alert"
          className="mt-3 text-sm text-somma-red border border-somma-red/30 bg-somma-red/10 px-3 py-2 rounded-client"
        >
          {error}
        </p>
      )}

      {/* CTA sticky no rodapé — respeita safe-area */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-somma-bg/95 backdrop-blur border-t border-somma-border pb-safe">
        <div className="mx-auto max-w-screen-mobile p-3 sm:p-4">
          <button
            onClick={handleSubmitClick}
            className="w-full rounded-client bg-somma-orange min-h-touch h-13 text-white font-display uppercase tracking-wide active:scale-[0.98] transition-transform focus-ring"
          >
            {hasSession
              ? `${method === "pix" ? "Gerar Pix" : "Ir para pagamento"} · ${brl(subtotal)}`
              : `Identificar e pagar · ${brl(subtotal)}`}
          </button>
        </div>
      </div>

      <IdentifyModal
        open={identifyOpen}
        onClose={() => setIdentifyOpen(false)}
        onSuccess={() => {
          setIdentifyOpen(false);
          setHasSession(true);
          void submitOrder();
        }}
      />
    </div>
  );
}

function Header({ venue, title }: { venue: string; title: string }) {
  return (
    <header className="flex items-center gap-3">
      <Link
        href={`/${venue}`}
        aria-label="Voltar"
        className="grid size-touch -ml-2 place-items-center text-somma-muted hover:text-white focus-ring"
      >
        <ArrowLeft className="size-5" />
      </Link>
      <h1 className="text-white font-display uppercase tracking-wide text-fluid-2xl">{title}</h1>
    </header>
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

function PixTimer() {
  const [s, setS] = useState(15 * 60);
  useEffect(() => {
    const t = setInterval(() => setS((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <p className="num text-somma-orange text-sm" aria-live="polite">
      expira em {mm}:{ss}
    </p>
  );
}
