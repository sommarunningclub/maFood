"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft } from "lucide-react";
import { useCart } from "@/stores/cart-store";
import { brl } from "@/lib/utils";
import { IdentifyModal } from "@/components/customer/identify-modal";

type Step = "form" | "card-form" | "submitting" | "pix" | "failed";
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
  const [copied, setCopied] = useState(false);
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

    // Delay mínimo 5s — UX: garante que o usuário vê o "Processando..." mesmo
    // se o Asaas responder muito rápido, evitando flash da tela de loading
    const minDelay = new Promise<void>((res) => setTimeout(res, 5000));
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
      // Cartão: independente de paid/pending, manda pro tracker (Realtime atualiza)
      clear();
      router.push(`/${venue}/order/${data.order_id}`);
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
    async function copyPix() {
      if (!pixPayload) return;
      try {
        await navigator.clipboard.writeText(pixPayload);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // fallback: select text from hidden input via document.execCommand
      }
    }

    return (
      <div className="min-h-dvh-100 p-4 sm:p-5 pt-safe pb-[88px] somma-grain">
        <Header venue={venue} title="Pagamento Pix" />
        <div className="mt-6 flex flex-col items-center text-center">
          <p className="num text-[11px] text-somma-muted">PEDIDO #{orderNumber}</p>
          <PixTimer />

          {/* QR Code */}
          <div className="bg-white p-3 rounded-client mt-4 shadow-lg">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR Code Pix" width={240} height={240} />
            ) : (
              <div className="size-[240px] grid place-items-center text-black/30 text-sm">
                Carregando QR…
              </div>
            )}
          </div>

          <p className="num text-fluid-2xl text-white mt-4">{brl(finalTotal)}</p>
          {discount > 0 && (
            <p className="num text-xs text-somma-green mt-1">
              − {brl(discount)} de desconto aplicado
            </p>
          )}
          <p className="text-somma-muted text-sm mt-1">Escaneie no app do seu banco</p>

          {/* Copiar código PIX */}
          {pixPayload && (
            <div className="mt-5 w-full max-w-xs space-y-2">
              <p className="num text-[10px] text-somma-muted uppercase tracking-wider">
                Ou copie o código Pix:
              </p>
              <div className="flex items-center gap-2 rounded-client border border-somma-border bg-somma-surface px-3 py-2">
                <p className="num text-[11px] text-somma-muted flex-1 truncate text-left">
                  {pixPayload.slice(0, 38)}…
                </p>
                <button
                  onClick={() => void copyPix()}
                  className={`num shrink-0 rounded px-3 min-h-[36px] text-[11px] uppercase tracking-wider transition-colors focus-ring ${
                    copied
                      ? "bg-somma-green/20 text-somma-green"
                      : "bg-somma-orange/15 text-somma-orange hover:bg-somma-orange/25"
                  }`}
                >
                  {copied ? "Copiado ✓" : "Copiar"}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={finalize}
            className="mt-6 w-full max-w-xs rounded-client bg-somma-green/90 min-h-touch h-12 text-black font-display uppercase tracking-wide focus-ring"
          >
            Acompanhar pedido
          </button>
          <p className="num text-[10px] text-somma-muted mt-3">
            Confirmação automática via webhook Asaas
          </p>
        </div>
      </div>
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
      <div className="min-h-dvh-100 pb-32 p-4 sm:p-5 pt-safe somma-grain">
        <Header venue={venue} title="Cartão de crédito" onBack={() => setStep("form")} />

        <section className="mt-5 space-y-3">
          <p className="num text-[11px] text-somma-muted">DADOS DO CARTÃO</p>
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

        <section className="mt-6 space-y-3">
          <p className="num text-[11px] text-somma-muted">DADOS DO TITULAR</p>
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

        {error && (
          <p
            role="alert"
            className="mt-4 text-sm text-somma-red border border-somma-red/30 bg-somma-red/10 px-3 py-2 rounded-client"
          >
            {error}
          </p>
        )}

        <div className="fixed bottom-0 inset-x-0 z-30 bg-somma-bg/95 backdrop-blur border-t border-somma-border pb-safe">
          <div className="mx-auto max-w-screen-mobile p-3 sm:p-4">
            <button
              onClick={() => void submitOrder()}
              disabled={!cardFilled}
              className="w-full rounded-client bg-somma-orange min-h-touch h-13 text-white font-display uppercase tracking-wide active:scale-[0.98] transition-transform focus-ring disabled:opacity-40"
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
      <div className="min-h-dvh-100 flex items-center justify-center p-8 somma-grain pt-safe pb-safe">
        <div className="text-center max-w-sm">
          <div className="size-14 mx-auto mb-4 rounded-full border-4 border-somma-border border-t-somma-orange animate-spin" />
          <h2 className="text-white font-display uppercase tracking-wide text-fluid-xl">
            {method === "pix" ? "Gerando Pix" : "Processando pagamento"}
          </h2>
          <p className="num text-xs text-somma-muted mt-2">
            Carregando dados do pagamento com segurança...
          </p>
          <p className="num text-[10px] text-somma-muted/60 mt-1">
            Não feche esta tela
          </p>
        </div>
      </div>
    );
  }

  if (step === "failed") {
    return (
      <div className="min-h-dvh-100 flex items-center justify-center p-6 somma-grain pt-safe pb-safe">
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
                className="w-full rounded-client bg-somma-orange min-h-touch h-12 text-white font-display uppercase tracking-wide focus-ring"
              >
                Limpar carrinho e voltar
              </button>
            ) : (
              <button
                onClick={() => {
                  setError(null);
                  setStep(method === "card" ? "card-form" : "form");
                }}
                className="w-full rounded-client bg-somma-orange min-h-touch h-12 text-white font-display uppercase tracking-wide focus-ring"
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
              className="w-full rounded-client border border-somma-border min-h-touch h-12 text-somma-text num text-xs uppercase tracking-widest focus-ring"
            >
              Trocar método de pagamento
            </button>
            <Link
              href={`/${venue}`}
              className="block num text-[11px] text-somma-muted underline underline-offset-4 pt-2 focus-ring"
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
    <div className="min-h-dvh-100 pb-32 p-4 sm:p-5 pt-safe somma-grain">
      <Header venue={venue} title="Checkout" />

      <section className="mt-5 rounded-client border border-somma-border bg-somma-surface overflow-hidden">
        {items.map((i, idx) => (
          <div
            key={i.product.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              idx > 0 ? "border-t border-somma-border/60" : ""
            }`}
          >
            {/* Qty controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => remove(i.product.id)}
                aria-label="Remover um"
                className="grid size-8 place-items-center rounded-full border border-somma-border text-somma-muted hover:border-somma-orange hover:text-somma-orange active:scale-95 transition-all focus-ring"
              >
                <span className="text-base leading-none">−</span>
              </button>
              <span className="num text-somma-orange text-sm w-6 text-center">{i.qty}</span>
              <button
                onClick={() => add(i.product)}
                aria-label="Adicionar um"
                className="grid size-8 place-items-center rounded-full border border-somma-border text-somma-muted hover:border-somma-orange hover:text-somma-orange active:scale-95 transition-all focus-ring"
              >
                <span className="text-base leading-none">+</span>
              </button>
            </div>

            {/* Nome */}
            <span className="text-somma-text text-sm min-w-0 flex-1 truncate">
              {i.product.name}
            </span>

            {/* Subtotal */}
            <span className="num text-somma-muted text-sm shrink-0">
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
          Cupom (se houver) será aplicado no servidor antes de gerar a cobrança.
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
          className="grid size-touch -ml-2 place-items-center text-somma-muted hover:text-white focus-ring"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-white font-display uppercase tracking-wide text-fluid-2xl">{title}</h1>
      </header>
    );
  }
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
