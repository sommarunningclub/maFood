"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useCart } from "@/stores/cart-store";
import { brl } from "@/lib/utils";

type Step = "form" | "pix" | "card" | "submitting";
type PaymentMethod = "pix" | "card";

export function CheckoutView({ venue }: { venue: string }) {
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

  const subtotal = total();
  const empty = items.length === 0;

  async function submitOrder(): Promise<{ ok: boolean }> {
    setError(null);
    setStep("submitting");
    if (!pdvId) {
      setError("Carrinho invalido");
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
    // Pedido já foi criado com status "paid" no servidor (simulado).
    // Aqui só limpamos carrinho e redirecionamos.
    clear();
    router.push(`/${venue}/order/${orderId}`);
  }

  if (empty && step === "form") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center somma-grain">
        <p className="text-6xl">🛒</p>
        <p className="text-somma-muted">Seu carrinho está vazio</p>
        <Link
          href={`/${venue}`}
          className="rounded-client bg-somma-orange px-5 h-11 flex items-center text-white font-display uppercase tracking-wide"
        >
          Ver praça
        </Link>
      </div>
    );
  }

  // ── Pix
  if (step === "pix") {
    return (
      <div className="min-h-screen p-5 somma-grain">
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
          <p className="num text-2xl text-white mt-4">{brl(finalTotal)}</p>
          {discount > 0 && (
            <p className="num text-xs text-somma-green mt-1">
              − {brl(discount)} de desconto aplicado
            </p>
          )}
          <p className="text-somma-muted text-sm mt-1">
            Escaneie no app do seu banco
          </p>
          <button
            onClick={finalize}
            className="mt-8 w-full max-w-xs rounded-client bg-somma-green/90 h-12 text-black font-display uppercase tracking-wide"
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

  // ── Card
  if (step === "card") {
    return (
      <div className="min-h-screen p-5 somma-grain">
        <Header venue={venue} title="Cartão de crédito" />
        <p className="num text-[11px] text-somma-muted mt-2">PEDIDO #{orderNumber}</p>
        <div className="mt-4 space-y-3">
          <Input label="Número do cartão" placeholder="0000 0000 0000 0000" />
          <Input label="Nome impresso" placeholder="COMO NO CARTÃO" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Validade" placeholder="MM/AA" />
            <Input label="CVV" placeholder="123" />
          </div>
          <button
            onClick={finalize}
            className="mt-4 w-full rounded-client bg-somma-orange h-12 text-white font-display uppercase tracking-wide"
          >
            Pagar {brl(finalTotal)}
          </button>
          <p className="num text-[10px] text-somma-muted text-center">
            (simulado nesta fase)
          </p>
        </div>
      </div>
    );
  }

  // ── Submitting (placeholder)
  if (step === "submitting") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 somma-grain">
        <p className="num text-sm text-somma-muted">Processando pedido...</p>
      </div>
    );
  }

  // ── Form
  return (
    <div className="min-h-screen pb-8 p-5 somma-grain">
      <Header venue={venue} title="Checkout" />

      <section className="mt-5 rounded-client border border-somma-border bg-somma-surface p-4">
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.product.id} className="flex justify-between text-sm">
              <span className="text-somma-text">
                <span className="num text-somma-orange">{i.qty}×</span>{" "}
                {i.product.name}
              </span>
              <span className="num text-somma-muted">
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
        <label className="num text-[11px] text-somma-muted">Cupom de desconto</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="OPCIONAL"
          className="mt-1 w-full rounded-client bg-somma-surface border border-somma-border px-3 h-11 text-white text-sm uppercase"
        />
      </section>

      <section className="mt-5">
        <p className="num text-[11px] text-somma-muted mb-2">Pagamento</p>
        <div className="grid grid-cols-2 gap-3">
          {(["pix", "card"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`rounded-client border h-12 num text-sm uppercase transition-colors ${
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
        <p className="mt-3 text-sm text-somma-red border border-somma-red/30 bg-somma-red/10 px-3 py-2 rounded-client">
          {error}
        </p>
      )}

      <button
        onClick={submitOrder}
        className="mt-6 w-full rounded-client bg-somma-orange h-13 text-white font-display uppercase tracking-wide"
      >
        {method === "pix" ? "Gerar Pix" : "Ir para pagamento"} · {brl(subtotal)}
      </button>
    </div>
  );
}

function Header({ venue, title }: { venue: string; title: string }) {
  return (
    <header className="flex items-center gap-3">
      <Link href={`/${venue}`} className="text-somma-muted text-xl">
        ←
      </Link>
      <h1 className="text-white font-display uppercase tracking-wide text-2xl">
        {title}
      </h1>
    </header>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="num text-[11px] text-somma-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-client bg-somma-surface border border-somma-border px-3 h-11 text-white text-sm"
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
    <p className="num text-somma-orange text-sm">
      expira em {mm}:{ss}
    </p>
  );
}
