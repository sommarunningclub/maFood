"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft } from "lucide-react";
import { useCart } from "@/stores/cart-store";
import { brl } from "@/lib/utils";
import { IdentifyModal } from "@/components/customer/identify-modal";
import { PixPayment } from "@/components/customer/pix-payment";

type Step = "form" | "card-form" | "submitting" | "pix" | "approved" | "failed";
type PaymentMethod = "pix" | "card";

interface CardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface HolderInfo {
  email: string;
  postalCode: string;
  addressNumber: string;
  addressComplement: string;
  phone: string;
}

interface CepLookup {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export function CheckoutView({
  venue,
  initialHasSession,
}: {
  venue: string;
  initialHasSession: boolean;
}) {
  const router = useRouter();
  const { items, pdvId, total, clear, add, remove } = useCart();
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
  const [pixPayload, setPixPayload] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(initialHasSession);
  const [identifyOpen, setIdentifyOpen] = useState(false);

  const [card, setCard] = useState<CardData>({
    holderName: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
  });
  const [holder, setHolder] = useState<HolderInfo>({
    email: "",
    postalCode: "",
    addressNumber: "",
    addressComplement: "",
    phone: "",
  });
  const [cepHint, setCepHint] = useState<CepLookup | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  const subtotal = total();
  const empty = items.length === 0;

  function handleSubmitClick() {
    if (!hasSession) {
      setIdentifyOpen(true);
      return;
    }
    if (method === "pix") {
      void submitOrder();
    } else {
      setStep("card-form");
    }
  }

  async function lookupCep(rawCep: string) {
    const cep = rawCep.replace(/\D/g, "");
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
  }

  async function submitOrder(): Promise<{ ok: boolean }> {
    setError(null);
    setStep("submitting");
    if (!pdvId) {
      setError("Carrinho inválido");
      setStep("form");
      return { ok: false };
    }
    const payload: Record<string, unknown> = {
      pdv_id: pdvId,
      method,
      notes: notes || null,
      coupon_code: code.trim() || null,
      items: items.map((i) => ({ product_id: i.product.id, qty: i.qty, notes: i.notes })),
    };
    if (method === "card") {
      payload.card = {
        holderName: card.holderName,
        number: card.number.replace(/\s/g, ""),
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        ccv: card.ccv,
      };
      payload.holder_info = {
        email: holder.email,
        postalCode: holder.postalCode.replace(/\D/g, ""),
        addressNumber: holder.addressNumber,
        addressComplement: holder.addressComplement || null,
        phone: holder.phone ? holder.phone.replace(/\D/g, "") : null,
      };
    }

    // Delay mínimo 3s — UX: garante que o usuário veja "Processando..." e
    // tenha um retorno claro de aprovado/negado mesmo se o Asaas responder rápido.
    const minDelay = new Promise<void>((res) => setTimeout(res, 3000));
    const requestP = fetch("/api/customer/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const [r] = await Promise.all([requestP, minDelay]);
    const data = await r.json();
    if (!r.ok) {
      setError(data.error ?? "Não foi possível concluir o pagamento");
      setStep("failed");
      return { ok: false };
    }
    setOrderNumber(data.order_number);
    setOrderId(data.order_id);
    setFinalTotal(Number(data.total));
    setDiscount(Number(data.discount));

    if (method === "pix") {
      // Guarda payload para o botão de copiar
      if (data.pix_payload) setPixPayload(data.pix_payload);
      // Prefere o QR base64 do Asaas; cai pra qrcode lib se ausente
      if (data.pix_qr_code) {
        setQr(
          data.pix_qr_code.startsWith("data:")
            ? data.pix_qr_code
            : `data:image/png;base64,${data.pix_qr_code}`
        );
      } else if (data.pix_payload) {
        setQr(await QRCode.toDataURL(data.pix_payload, { width: 240, margin: 1 }));
      }
      setStep("pix");
    } else {
      // Cartão aprovado: mostra confirmação explícita antes do tracker.
      setStep("approved");
    }
    return { ok: true };
  }

  async function regeneratePix() {
    // Cancela o pedido/cobrança anterior (e devolve o cupom) antes de gerar um novo,
    // evitando cobrança duplicada e o código antigo ainda válido estrandar o cliente.
    if (orderId) {
      await fetch(`/api/customer/orders/${orderId}/cancel`, { method: "POST" }).catch(() => {});
    }
    await submitOrder();
  }

  function finalize() {
    clear();
    router.push(`/${venue}/order/${orderId}`);
  }

  if (empty && step === "form") {
    return (
      <div className="min-h-dvh-100 flex flex-col items-center justify-center gap-4 p-8 text-center pt-safe pb-safe">
        <p className="text-6xl">🛒</p>
        <p className="text-mafood-text-secondary">Seu carrinho está vazio</p>
        <Link
          href={`/${venue}`}
          className="rounded-mafood-md bg-mafood-primary-strong px-5 min-h-touch h-12 inline-flex items-center text-white font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
        >
          Ver praça
        </Link>
      </div>
    );
  }

  if (step === "pix" && orderId) {
    return (
      <PixPayment
        venue={venue}
        orderId={orderId}
        orderNumber={orderNumber}
        qr={qr}
        pixPayload={pixPayload}
        finalTotal={finalTotal}
        discount={discount}
        onRegenerate={() => void regeneratePix()}
        onFinalize={finalize}
      />
    );
  }

  if (step === "card-form") {
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
      <div className="min-h-dvh-100 pb-32 p-4 sm:p-5 pt-safe">
        <Header venue={venue} title="Cartão de crédito" onBack={() => setStep("form")} />

        <section className="mt-5 space-y-3">
          <p className="num text-[11px] text-mafood-text-secondary">DADOS DO CARTÃO</p>
          <Input
            label="Número do cartão"
            value={formatCardNumber(card.number)}
            onChange={(v) => setCard({ ...card, number: v.replace(/\D/g, "").slice(0, 19) })}
            placeholder="0000 0000 0000 0000"
            inputMode="numeric"
            autoComplete="cc-number"
          />
          <Input
            label="Nome impresso"
            value={card.holderName}
            onChange={(v) => setCard({ ...card, holderName: v })}
            placeholder="COMO NO CARTÃO"
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

        <section className="mt-6 space-y-3">
          <p className="num text-[11px] text-mafood-text-secondary">DADOS DO TITULAR</p>
          <Input
            label="E-mail"
            value={holder.email}
            onChange={(v) => setHolder({ ...holder, email: v })}
            placeholder="seu@email.com"
            inputMode="email"
            type="email"
            autoComplete="email"
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
              autoComplete="postal-code"
            />
            <div className="num text-[10px] text-mafood-text-secondary pb-3 min-w-[60px]">
              {cepLoading ? "buscando..." : cepHint ? "✓" : ""}
            </div>
          </div>
          {cepHint?.street && (
            <p className="num text-[11px] text-mafood-text-secondary -mt-1">
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
            inputMode="tel"
            type="tel"
            autoComplete="tel"
          />
        </section>

        {error && (
          <p
            role="alert"
            className="mt-4 text-sm text-mafood-accent-dark border border-mafood-accent-dark/30 bg-mafood-accent-dark/10 px-3 py-2 rounded-mafood-md"
          >
            {error}
          </p>
        )}

        <div className="fixed bottom-0 inset-x-0 z-30 bg-mafood-background/95 backdrop-blur border-t border-mafood-border pb-safe">
          <div className="mx-auto max-w-screen-mobile p-3 sm:p-4">
            <button
              onClick={() => void submitOrder()}
              disabled={!cardFilled}
              className="w-full rounded-mafood-md bg-mafood-primary-strong min-h-touch h-13 text-white font-semibold active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary disabled:opacity-40"
            >
              Pagar {brl(subtotal)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "submitting") {
    return (
      <div className="min-h-dvh-100 flex items-center justify-center p-8 pt-safe pb-safe">
        <div className="text-center max-w-sm">
          <div className="size-14 mx-auto mb-4 rounded-full border-4 border-mafood-border border-t-mafood-primary animate-spin" />
          <h2 className="mafood-display text-mafood-text-primary text-fluid-xl">
            {method === "pix" ? "Gerando Pix" : "Processando pagamento"}
          </h2>
          <p className="num text-xs text-mafood-text-secondary mt-2">
            Carregando dados do pagamento com segurança...
          </p>
          <p className="num text-[10px] text-mafood-text-secondary/60 mt-1">
            Não feche esta tela
          </p>
        </div>
      </div>
    );
  }

  if (step === "approved") {
    return (
      <div className="min-h-dvh-100 flex items-center justify-center p-6 pt-safe pb-safe">
        <div className="text-center max-w-sm w-full">
          <div className="size-20 mx-auto mb-5 rounded-full border-4 border-mafood-success-strong/40 bg-mafood-success/10 grid place-items-center">
            <span className="text-4xl">✓</span>
          </div>
          <h2 className="mafood-display text-mafood-text-primary text-fluid-2xl">
            Pagamento aprovado
          </h2>
          <p className="num text-sm text-mafood-text-secondary mt-3">
            Aguardando o restaurante aceitar seu pedido
          </p>
          <button
            onClick={finalize}
            className="mt-6 w-full rounded-mafood-md bg-mafood-success-strong min-h-touch h-12 text-white font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
          >
            Acompanhar pedido
          </button>
        </div>
      </div>
    );
  }

  if (step === "failed") {
    return (
      <div className="min-h-dvh-100 flex items-center justify-center p-6 pt-safe pb-safe">
        <div className="text-center max-w-sm w-full">
          <div className="size-20 mx-auto mb-5 rounded-full border-4 border-mafood-accent-dark/40 bg-mafood-accent-dark/10 grid place-items-center">
            <span className="text-4xl">✕</span>
          </div>
          <h2 className="mafood-display text-mafood-text-primary text-fluid-2xl">
            Pagamento não foi concluído
          </h2>
          {error && (
            <p
              role="alert"
              className="num text-sm text-mafood-text-secondary mt-3 border border-mafood-accent-dark/20 bg-mafood-accent-dark/5 px-3 py-2 rounded-mafood-md"
            >
              {error}
            </p>
          )}
          <p className="num text-[11px] text-mafood-text-secondary/80 mt-3">
            Nenhum valor foi cobrado. Você pode tentar novamente com outro método ou cartão.
          </p>
          <div className="mt-6 space-y-2">
            {/* Produto inválido = IDs do carrinho desatualizados; orientar o usuário a limpar */}
            {error && /invalido|inválido|não encontrado/i.test(error) ? (
              <button
                onClick={() => {
                  clear();
                  router.push(`/${venue}`);
                }}
                className="w-full rounded-mafood-md bg-mafood-primary-strong min-h-touch h-12 text-white font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
              >
                Limpar carrinho e voltar
              </button>
            ) : (
              <button
                onClick={() => {
                  setError(null);
                  setStep(method === "card" ? "card-form" : "form");
                }}
                className="w-full rounded-mafood-md bg-mafood-primary-strong min-h-touch h-12 text-white font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
              >
                Tentar novamente
              </button>
            )}
            <button
              onClick={() => {
                setError(null);
                setMethod(method === "card" ? "pix" : "card");
                setStep("form");
              }}
              className="w-full rounded-mafood-md border border-mafood-border min-h-touch h-12 text-mafood-text-primary num text-xs uppercase tracking-widest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
            >
              Trocar método de pagamento
            </button>
            <Link
              href={`/${venue}`}
              className="block num text-[11px] text-mafood-text-secondary underline underline-offset-4 pt-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
            >
              Voltar à praça
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Form
  return (
    <div className="min-h-dvh-100 pb-32 p-4 sm:p-5 pt-safe">
      <Header venue={venue} title="Checkout" />

      <section className="mt-5 rounded-mafood-md border border-mafood-border bg-mafood-surface-strong overflow-hidden">
        {items.map((i, idx) => (
          <div
            key={i.product.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              idx > 0 ? "border-t border-mafood-border/60" : ""
            }`}
          >
            {/* Qty controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => remove(i.product.id)}
                aria-label="Remover um"
                className="grid size-11 place-items-center rounded-full border border-mafood-border text-mafood-text-secondary hover:border-mafood-primary hover:text-mafood-primary-strong active:scale-95 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
              >
                <span className="text-base leading-none">−</span>
              </button>
              <span className="num text-mafood-primary-strong text-sm w-6 text-center">{i.qty}</span>
              <button
                onClick={() => add(i.product)}
                aria-label="Adicionar um"
                className="grid size-11 place-items-center rounded-full border border-mafood-border text-mafood-text-secondary hover:border-mafood-primary hover:text-mafood-primary-strong active:scale-95 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
              >
                <span className="text-base leading-none">+</span>
              </button>
            </div>

            {/* Nome */}
            <span className="text-mafood-text-primary text-sm min-w-0 flex-1 truncate">
              {i.product.name}
            </span>

            {/* Subtotal */}
            <span className="num text-mafood-text-secondary text-sm shrink-0">
              {brl(i.qty * i.product.price)}
            </span>
          </div>
        ))}
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
          <span className="num text-[11px] text-mafood-text-secondary">Cupom de desconto</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="OPCIONAL"
            autoCapitalize="characters"
            autoCorrect="off"
            className="mt-1 w-full rounded-mafood-md bg-mafood-surface-strong border border-mafood-border px-3 min-h-touch h-12 text-mafood-text-primary text-sm uppercase focus:border-mafood-primary outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
          />
        </label>
      </section>

      <section className="mt-5">
        <p className="num text-[11px] text-mafood-text-secondary mb-2">Pagamento</p>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Método de pagamento">
          {(["pix", "card"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              role="radio"
              aria-checked={method === m}
              className={`rounded-mafood-md border min-h-touch h-12 num text-sm uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary ${
                method === m
                  ? "border-mafood-primary bg-mafood-primary/10 text-mafood-primary-strong"
                  : "border-mafood-border text-mafood-text-secondary"
              }`}
            >
              {m === "pix" ? "Pix" : "Cartão"}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5 border-t border-mafood-border pt-4 space-y-1 num text-sm">
        <div className="flex justify-between text-mafood-text-primary text-lg font-semibold">
          <span>Total</span>
          <span>{brl(subtotal)}</span>
        </div>
        <p className="num text-[10px] text-mafood-text-secondary">
          Cupom (se houver) será aplicado no servidor antes de gerar a cobrança.
        </p>
      </section>

      {error && (
        <p
          role="alert"
          className="mt-3 text-sm text-mafood-accent-dark border border-mafood-accent-dark/30 bg-mafood-accent-dark/10 px-3 py-2 rounded-mafood-md"
        >
          {error}
        </p>
      )}

      <div className="fixed bottom-0 inset-x-0 z-30 bg-mafood-background/95 backdrop-blur border-t border-mafood-border pb-safe">
        <div className="mx-auto max-w-screen-mobile p-3 sm:p-4">
          <button
            onClick={handleSubmitClick}
            className="w-full rounded-mafood-md bg-mafood-primary-strong min-h-touch h-13 text-white font-semibold active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
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
          if (method === "pix") void submitOrder();
          else setStep("card-form");
        }}
      />
    </div>
  );
}

function Header({
  venue,
  title,
  onBack,
}: {
  venue: string;
  title: string;
  onBack?: () => void;
}) {
  if (onBack) {
    return (
      <header className="flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Voltar"
          className="grid size-touch -ml-2 place-items-center text-mafood-text-secondary hover:text-mafood-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="mafood-display text-mafood-text-primary text-fluid-2xl">{title}</h1>
      </header>
    );
  }
  return (
    <header className="flex items-center gap-3">
      <Link
        href={`/${venue}`}
        aria-label="Voltar"
        className="grid size-touch -ml-2 place-items-center text-mafood-text-secondary hover:text-mafood-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
      >
        <ArrowLeft className="size-5" />
      </Link>
      <h1 className="mafood-display text-mafood-text-primary text-fluid-2xl">{title}</h1>
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
  type = "text",
  autoComplete,
}: {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "email" | "tel";
  autoCapitalize?: "off" | "none" | "sentences" | "words" | "characters";
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="num text-[11px] text-mafood-text-secondary">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        type={type}
        autoComplete={autoComplete}
        className="mt-1 w-full rounded-mafood-md bg-mafood-surface-strong border border-mafood-border px-3 min-h-touch h-12 text-mafood-text-primary text-base outline-none focus:border-mafood-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
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
