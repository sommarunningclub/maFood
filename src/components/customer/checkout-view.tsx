"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useCart, cartItemUnitPrice } from "@/stores/cart-store";
import { brl } from "@/lib/utils";
import { lineDisplayName } from "@/lib/product-sizes";
import { IdentifyModal } from "@/components/customer/identify-modal";
import { PixPayment } from "@/components/customer/pix-payment";
import { EmptyState } from "@/components/customer/ui/mafood-states";
import { BrandMomentGif } from "@/components/customer/brand-moment-gif";
import { customerReadyForCard } from "@/lib/customer-profile";
import type { Product } from "@/types";

type Step =
  | "form"
  | "profile"
  | "card-form"
  | "submitting"
  | "pix"
  | "pending"
  | "approved"
  | "failed";
type PaymentMethod = "pix" | "card" | "counter";

interface CardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export function CheckoutView({
  venue,
  initialHasSession,
}: {
  venue: string;
  initialHasSession: boolean;
}) {
  const router = useRouter();
  const {
    items,
    pdvId,
    payAtCounter,
    total,
    clear,
    add,
    remove,
    hasHydrated,
    reconcile,
  } = useCart();
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<PaymentMethod>(payAtCounter ? "counter" : "pix");
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
  const [cartChecking, setCartChecking] = useState(true);
  const [cartValidated, setCartValidated] = useState(false);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const regeneratingRef = useRef(false);

  const [card, setCard] = useState<CardData>({
    holderName: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
  });

  // Completar cadastro (clientes antigos sem endereço)
  const [profEmail, setProfEmail] = useState("");
  const [profPhone, setProfPhone] = useState("");
  const [profCep, setProfCep] = useState("");
  const [profNumber, setProfNumber] = useState("");
  const [profComplement, setProfComplement] = useState("");
  const [profCepHint, setProfCepHint] = useState<string | null>(null);
  const [profSaving, setProfSaving] = useState(false);

  const subtotal = total();
  const empty = items.length === 0;

  const refreshCart = useCallback(async () => {
    if (!hasHydrated) return;

    const current = useCart.getState();
    if (!current.pdvId || current.items.length === 0) {
      setCartValidated(true);
      setCartChecking(false);
      return;
    }

    setCartChecking(true);
    setCartValidated(false);
    setCartNotice(null);
    try {
      const response = await fetch("/api/customer/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdv_id: current.pdvId,
          product_ids: current.items.map((item) => item.product.id),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        pdv?: { id: string; pay_at_counter: boolean };
        products?: Product[];
      };
      if (!response.ok || !data.pdv || !Array.isArray(data.products)) {
        throw new Error(data.error ?? "Não foi possível atualizar a sacola");
      }

      const result = reconcile(data.products, {
        pdvId: data.pdv.id,
        payAtCounter: data.pdv.pay_at_counter,
      });
      const changes: string[] = [];
      if (result.removedItems > 0) {
        changes.push(
          `${result.removedItems} ${result.removedItems === 1 ? "item indisponível foi removido" : "itens indisponíveis foram removidos"}`
        );
      }
      if (result.pricesChanged) changes.push("os preços foram atualizados");
      if (result.paymentModeChanged) changes.push("a forma de pagamento do PDV mudou");
      if (changes.length > 0) {
        setCartNotice(`${changes.join(" e ")}. Revise a sacola antes de continuar.`);
      }
      setCartValidated(true);
    } catch {
      setError("Não foi possível atualizar a sacola. Verifique sua conexão e tente novamente.");
    } finally {
      setCartChecking(false);
    }
  }, [hasHydrated, reconcile]);

  useEffect(() => {
    if (payAtCounter) setMethod("counter");
    else setMethod((m) => (m === "counter" ? "pix" : m));
  }, [payAtCounter]);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  useEffect(() => {
    if (step !== "pending" || !orderId) return;

    let active = true;
    const check = async () => {
      try {
        const response = await fetch(`/api/customer/orders/${orderId}?view=status`, {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as {
          status?: string;
        };
        if (!active || !response.ok) return;
        if (["paid", "preparing", "ready", "partial", "delivered"].includes(data.status ?? "")) {
          setStep("approved");
        } else if (data.status === "cancelled") {
          setError("O pagamento não foi confirmado.");
          setStep("failed");
        }
      } catch {
        // Mantém a tela de espera; a próxima consulta tenta novamente.
      }
    };

    void check();
    const interval = window.setInterval(() => void check(), 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [orderId, step]);

  async function ensureCardProfile(): Promise<boolean> {
    try {
      const response = await fetch("/api/customer/me");
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        customer?: {
          email?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          address_number?: string | null;
          address_complement?: string | null;
        };
      };
      if (!response.ok || !data.customer) {
        setError(data.error ?? "Não foi possível carregar seu cadastro");
        return false;
      }
      const customer = data.customer;
      if (customerReadyForCard(customer)) return true;
      setProfEmail(customer.email ?? "");
      setProfPhone(customer.phone ? maskPhone(customer.phone) : "");
      setProfCep(customer.postal_code ?? "");
      setProfNumber(customer.address_number ?? "");
      setProfComplement(customer.address_complement ?? "");
      setProfCepHint(null);
      setStep("profile");
      return false;
    } catch {
      setError("Não foi possível carregar seu cadastro. Verifique sua conexão.");
      return false;
    }
  }

  async function goToCardCheckout() {
    setError(null);
    const ok = await ensureCardProfile();
    if (ok) setStep("card-form");
  }

  function handleSubmitClick() {
    if (submittingRef.current || cartChecking || !cartValidated) return;
    if (!hasSession) {
      setIdentifyOpen(true);
      return;
    }
    if (method === "card") {
      void goToCardCheckout();
      return;
    }
    void submitOrder();
  }

  async function lookupProfileCep(rawCep: string) {
    const cep = rawCep.replace(/\D/g, "");
    if (cep.length !== 8) {
      setProfCepHint(null);
      return;
    }
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
      if (!r.ok) {
        setProfCepHint(null);
        return;
      }
      const data = await r.json();
      setProfCepHint(
        [data.street, data.neighborhood, data.city && `${data.city}/${data.state}`]
          .filter(Boolean)
          .join(" · ") || null
      );
    } catch {
      setProfCepHint(null);
    }
  }

  async function saveProfileAndContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setProfSaving(true);
    try {
      const response = await fetch("/api/customer/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: profEmail.trim(),
          phone: profPhone.replace(/\D/g, ""),
          postal_code: profCep.replace(/\D/g, ""),
          address_number: profNumber.trim(),
          address_complement: profComplement.trim() || null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Não foi possível salvar");
        return;
      }
      setStep("card-form");
    } catch {
      setError("Não foi possível salvar. Verifique sua conexão.");
    } finally {
      setProfSaving(false);
    }
  }

  async function submitOrder(): Promise<{ ok: boolean }> {
    if (submittingRef.current) return { ok: false };
    if (!cartValidated || cartChecking) {
      setError("Aguarde a atualização da sacola antes de continuar.");
      return { ok: false };
    }

    submittingRef.current = true;
    setError(null);
    setStep("submitting");
    try {
      if (!pdvId || items.length === 0) {
        setError("Carrinho inválido");
        setStep("form");
        return { ok: false };
      }
      const payload: Record<string, unknown> = {
        pdv_id: pdvId,
        method,
        notes: notes || null,
        coupon_code: code.trim() || null,
        items: items.map((i) => ({
          product_id: i.product.id,
          qty: i.qty,
          notes: i.notes,
          size_label: i.sizeLabel ?? null,
        })),
      };
      if (method === "card") {
        payload.card = {
          holderName: card.holderName,
          number: card.number.replace(/\s/g, ""),
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          ccv: card.ccv,
        };
      }

      const response = await fetch("/api/customer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        order_number?: number;
        order_id?: string;
        total?: number;
        discount?: number;
        status?: string;
        pix_payload?: string | null;
        pix_qr_code?: string | null;
      };
      if (!response.ok || !data.order_id) {
        setError(data.error ?? "Não foi possível concluir o pagamento");
        setStep("failed");
        return { ok: false };
      }

      setOrderNumber(data.order_number ?? null);
      setOrderId(data.order_id);
      setFinalTotal(Number(data.total ?? subtotal));
      setDiscount(Number(data.discount ?? 0));

      if (method === "pix") {
        setPixPayload(data.pix_payload ?? null);
        if (data.pix_qr_code) {
          setQr(
            data.pix_qr_code.startsWith("data:")
              ? data.pix_qr_code
              : `data:image/png;base64,${data.pix_qr_code}`
          );
        } else if (data.pix_payload) {
          try {
            setQr(await QRCode.toDataURL(data.pix_payload, { width: 240, margin: 1 }));
          } catch {
            setQr(null);
          }
        }
        setStep("pix");
      } else if (method === "counter" || data.status === "paid") {
        setStep("approved");
      } else {
        setStep("pending");
      }
      return { ok: true };
    } catch {
      setError(
        "A resposta do pagamento não foi confirmada. Confira seu banco antes de tentar novamente."
      );
      setStep("failed");
      return { ok: false };
    } finally {
      submittingRef.current = false;
    }
  }

  async function regeneratePix() {
    if (regeneratingRef.current || !orderId) return;
    regeneratingRef.current = true;
    setError(null);
    setStep("submitting");
    try {
      const response = await fetch(`/api/customer/orders/${orderId}/cancel`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Não foi possível cancelar o Pix anterior");
        setStep("failed");
        return;
      }
      setOrderId(null);
      setOrderNumber(null);
      setQr(null);
      setPixPayload(null);
      await submitOrder();
    } catch {
      setError("Não foi possível cancelar o Pix anterior. Tente novamente.");
      setStep("failed");
    } finally {
      regeneratingRef.current = false;
    }
  }

  function finalize() {
    clear();
    router.push(`/${venue}/order/${orderId}`);
  }

  if (!hasHydrated || cartChecking) {
    return (
      <div className="min-h-dvh-100 flex items-center justify-center p-8 pt-safe pb-safe">
        <div className="text-center max-w-sm" role="status" aria-live="polite">
          <BrandMomentGif variant="cart" size={150} className="mb-2" />
          <h2 className="mafood-display text-mafood-text-primary text-fluid-xl">
            Atualizando sua sacola
          </h2>
          <p className="num text-xs text-mafood-text-secondary mt-2">
            Conferindo disponibilidade e preços atuais…
          </p>
        </div>
      </div>
    );
  }

  if (!cartValidated && !empty) {
    return (
      <div className="min-h-dvh-100 flex items-center justify-center p-6 pt-safe pb-safe">
        <div className="text-center max-w-sm w-full">
          <h2 className="mafood-display text-mafood-text-primary text-fluid-xl">
            Não foi possível atualizar a sacola
          </h2>
          <p role="alert" className="num text-sm text-mafood-text-secondary mt-3">
            {error ?? "Verifique sua conexão e tente novamente."}
          </p>
          <button
            type="button"
            onClick={() => void refreshCart()}
            className="mt-6 w-full rounded-mafood-md bg-mafood-primary-strong min-h-touch h-12 text-white font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
          >
            Tentar atualizar
          </button>
          <Link
            href={`/${venue}`}
            className="mt-3 inline-flex min-h-touch items-center num text-[11px] text-mafood-text-secondary underline underline-offset-4"
          >
            Voltar à praça
          </Link>
        </div>
      </div>
    );
  }

  if (empty && step === "form") {
    return (
      <div className="min-h-dvh-100 flex flex-col items-center justify-center p-8 pt-safe pb-safe">
        <EmptyState
          icon={ShoppingBag}
          title="Sua sacola está vazia"
          hint="Escolha um restaurante e adicione itens para continuar."
        />
        <Link
          href={`/${venue}`}
          className="mt-2 rounded-mafood-md bg-mafood-primary-strong px-5 min-h-touch h-12 inline-flex items-center text-white font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
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

  if (step === "profile") {
    const profileReady =
      profEmail.includes("@") &&
      profPhone.replace(/\D/g, "").length >= 10 &&
      profCep.replace(/\D/g, "").length === 8 &&
      profNumber.trim().length >= 1;

    return (
      <div className="min-h-dvh-100 pb-32 p-4 sm:p-5 pt-safe">
        <Header venue={venue} title="Complete seu cadastro" onBack={() => setStep("form")} />
        <p className="mt-3 text-[13px] text-mafood-text-secondary leading-snug">
          Precisamos destes dados uma vez. No pagamento, só o cartão.
        </p>
        <form onSubmit={(e) => void saveProfileAndContinue(e)} className="mt-5 space-y-3">
          <Input
            label="E-mail *"
            value={profEmail}
            onChange={setProfEmail}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="seu@email.com"
          />
          <Input
            label="Telefone *"
            value={profPhone}
            onChange={(v) => setProfPhone(maskPhone(v))}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
          />
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Input
              label="CEP *"
              value={maskCep(profCep)}
              onChange={(v) => {
                const raw = v.replace(/\D/g, "").slice(0, 8);
                setProfCep(raw);
                if (raw.length === 8) void lookupProfileCep(raw);
                else setProfCepHint(null);
              }}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
            />
            <Input
              label="Nº *"
              value={profNumber}
              onChange={(v) => setProfNumber(v.slice(0, 20))}
              inputMode="numeric"
              placeholder="123"
            />
          </div>
          {profCepHint && (
            <p className="num text-[11px] text-mafood-text-secondary -mt-1">{profCepHint}</p>
          )}
          <Input
            label="Complemento"
            value={profComplement}
            onChange={setProfComplement}
            placeholder="Apto, bloco… (opcional)"
            autoComplete="address-line2"
          />
          {error && (
            <p
              role="alert"
              className="text-sm text-mafood-accent-dark border border-mafood-accent-dark/30 bg-mafood-accent-dark/10 px-3 py-2 rounded-mafood-md"
            >
              {error}
            </p>
          )}
          <div className="fixed bottom-0 inset-x-0 z-30 bg-mafood-background/95 backdrop-blur border-t border-mafood-border pb-safe">
            <div className="mx-auto max-w-screen-mobile p-3 sm:p-4">
              <button
                type="submit"
                disabled={!profileReady || profSaving}
                className="w-full rounded-mafood-md bg-mafood-primary-strong min-h-touch h-13 text-white font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
              >
                {profSaving ? "Salvando…" : "Continuar para o cartão"}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  if (step === "card-form") {
    const cardFilled =
      card.holderName.trim().length >= 2 &&
      card.number.replace(/\D/g, "").length >= 13 &&
      card.expiryMonth.length >= 1 &&
      card.expiryYear.length >= 2 &&
      card.ccv.length >= 3;

    return (
      <div className="min-h-dvh-100 pb-32 p-4 sm:p-5 pt-safe">
        <Header venue={venue} title="Cartão de crédito" onBack={() => setStep("form")} />

        <section className="mt-5 space-y-3">
          <p className="num text-[11px] text-mafood-text-secondary">
            Só os dados do cartão — o restante já está no seu cadastro
          </p>
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
          <BrandMomentGif variant="cart" size={180} className="mb-2" />
          <h2 className="mafood-display text-mafood-text-primary text-fluid-xl">
            {method === "counter"
              ? "Enviando pedido"
              : method === "pix"
                ? "Gerando Pix"
                : "Processando pagamento"}
          </h2>
          <p className="num text-xs text-mafood-text-secondary mt-2">
            {method === "counter"
              ? "Registrando seu pedido na fila do PDV…"
              : "Carregando dados do pagamento com segurança..."}
          </p>
          <p className="num text-[10px] text-mafood-text-secondary/60 mt-1">
            Não feche esta tela
          </p>
        </div>
      </div>
    );
  }

  if (step === "pending") {
    return (
      <div className="min-h-dvh-100 flex items-center justify-center p-6 pt-safe pb-safe">
        <div className="text-center max-w-sm w-full" role="status" aria-live="polite">
          <div className="size-16 mx-auto mb-5 rounded-full border-4 border-mafood-border border-t-mafood-primary animate-spin" />
          <h2 className="mafood-display text-mafood-text-primary text-fluid-2xl">
            Pagamento em análise
          </h2>
          <p className="num text-sm text-mafood-text-secondary mt-3">
            O banco ainda não confirmou o cartão. Esta tela atualizará automaticamente.
          </p>
          {orderNumber != null && (
            <p className="mt-4 text-fluid-lg font-semibold tabular-nums text-mafood-primary-strong">
              Pedido #{orderNumber}
            </p>
          )}
          <button
            type="button"
            onClick={finalize}
            className="mt-6 w-full rounded-mafood-md border border-mafood-border min-h-touch h-12 text-mafood-text-primary font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
          >
            Acompanhar pedido
          </button>
        </div>
      </div>
    );
  }

  if (step === "approved") {
    return (
      <div className="min-h-dvh-100 flex items-center justify-center p-6 pt-safe pb-safe">
        <div className="text-center max-w-sm w-full">
          <BrandMomentGif variant="success" size={200} className="mb-3" />
          <h2 className="mafood-display text-mafood-text-primary text-fluid-2xl">
            {method === "counter" ? "Pedido enviado" : "Pagamento aprovado"}
          </h2>
          <p className="num text-sm text-mafood-text-secondary mt-3">
            {method === "counter"
              ? "Pague na maquininha (Pix ou cartão). A produção começa após a confirmação do pagamento."
              : "Aguardando o restaurante aceitar seu pedido"}
          </p>
          {orderNumber != null && method === "counter" && (
            <p className="mt-4 text-fluid-xl font-semibold tabular-nums text-mafood-primary-strong">
              Pedido #{orderNumber}
            </p>
          )}
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
            Se houve falha de conexão, confira o app do banco antes de tentar novamente.
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

      {cartNotice && (
        <p
          role="status"
          className="mt-4 rounded-mafood-md border border-mafood-gold/40 bg-mafood-gold/10 px-3 py-2 text-sm text-mafood-text-primary"
        >
          {cartNotice}
        </p>
      )}

      <section className="mt-5 rounded-mafood-md border border-mafood-border bg-mafood-surface-strong overflow-hidden">
        {items.map((i, idx) => (
          <div
            key={`${i.product.id}::${i.sizeLabel ?? ""}`}
            className={`flex items-center gap-3 px-4 py-3 ${
              idx > 0 ? "border-t border-mafood-border/60" : ""
            }`}
          >
            {/* Qty controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => remove(i.product.id, i.sizeLabel)}
                aria-label="Remover um"
                className="grid size-11 place-items-center rounded-full border border-mafood-border text-mafood-text-secondary hover:border-mafood-primary hover:text-mafood-primary-strong active:scale-95 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
              >
                <span className="text-base leading-none">−</span>
              </button>
              <span className="num text-mafood-primary-strong text-sm w-6 text-center">{i.qty}</span>
              <button
                onClick={() =>
                  add(i.product, { payAtCounter, sizeLabel: i.sizeLabel })
                }
                aria-label="Adicionar um"
                className="grid size-11 place-items-center rounded-full border border-mafood-border text-mafood-text-secondary hover:border-mafood-primary hover:text-mafood-primary-strong active:scale-95 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
              >
                <span className="text-base leading-none">+</span>
              </button>
            </div>

            {/* Nome */}
            <span className="text-mafood-text-primary text-sm min-w-0 flex-1 truncate">
              {lineDisplayName(i.product.name, i.sizeLabel)}
            </span>

            {/* Subtotal */}
            <span className="num text-mafood-text-secondary text-sm shrink-0">
              {brl(i.qty * cartItemUnitPrice(i))}
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
        {payAtCounter ? (
          <div className="rounded-mafood-md border border-mafood-primary/40 bg-mafood-primary/5 px-4 py-3.5">
            <p className="text-[14px] font-semibold text-mafood-text-primary">
              Pagar na tenda do PDV
            </p>
            <p className="mt-1 text-[12px] leading-snug text-mafood-text-secondary">
              Pague na maquininha da tenda (Pix ou cartão). A produção só começa
              depois que o PDV confirmar o pagamento — mostre o número do pedido.
            </p>
          </div>
        ) : (
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
        )}
      </section>

      <section className="mt-5 border-t border-mafood-border pt-4 space-y-1 num text-sm">
        <div className="flex justify-between text-mafood-text-primary text-lg font-semibold">
          <span>Total</span>
          <span>{brl(subtotal)}</span>
        </div>
        <p className="num text-[10px] text-mafood-text-secondary">
          {payAtCounter
            ? "Cupom (se houver) será aplicado ao enviar o pedido."
            : "Cupom (se houver) será aplicado no servidor antes de gerar a cobrança."}
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
            disabled={cartChecking || !cartValidated || submittingRef.current}
            className="w-full rounded-mafood-md bg-mafood-primary-strong min-h-touch h-13 text-white font-semibold active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {hasSession
              ? payAtCounter
                ? `Enviar pedido · ${brl(subtotal)}`
                : `${method === "pix" ? "Gerar Pix" : "Ir para pagamento"} · ${brl(subtotal)}`
              : `Identificar e continuar · ${brl(subtotal)}`}
          </button>
        </div>
      </div>

      <IdentifyModal
        open={identifyOpen}
        onClose={() => setIdentifyOpen(false)}
        onSuccess={() => {
          setIdentifyOpen(false);
          setHasSession(true);
          if (method === "card") void goToCardCheckout();
          else void submitOrder();
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
