"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { brl } from "@/lib/utils";
import {
  formatCountdown,
  isPaidStatus,
  PIX_EXPIRY_SECONDS,
  PIX_POLL_MS,
} from "@/lib/pix";

interface PixPaymentProps {
  venue: string;
  orderId: string;
  orderNumber: number | null;
  qr: string | null;
  pixPayload: string | null;
  finalTotal: number;
  discount: number;
  onRegenerate: () => void;
  onFinalize: () => void;
}

export function PixPayment({
  orderId,
  orderNumber,
  qr,
  pixPayload,
  finalTotal,
  discount,
  onRegenerate,
  onFinalize,
}: PixPaymentProps) {
  const [phase, setPhase] = useState<"waiting" | "paid" | "expired">("waiting");
  const [seconds, setSeconds] = useState(PIX_EXPIRY_SECONDS);
  const [copied, setCopied] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/customer/orders/${orderId}?view=status`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json().catch(() => ({}))) as { status?: string };
      if (isPaidStatus(data.status)) setPhase("paid");
      if (data.status === "cancelled") setPhase("expired");
    } catch {
      // Polling tenta novamente; não derruba a tela por uma falha transitória.
    }
  }, [orderId]);

  // Contador de expiração
  useEffect(() => {
    const t = setInterval(() => {
      setSeconds((x) => {
        if (x <= 1) {
          if (phaseRef.current === "waiting") setPhase("expired");
          return 0;
        }
        return x - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Polling autenticado: evita expor o payload completo de `orders` ao browser.
  useEffect(() => {
    void checkStatus();
    const poll = setInterval(() => void checkStatus(), PIX_POLL_MS);
    return () => {
      clearInterval(poll);
    };
  }, [checkStatus]);

  async function copyPix() {
    if (!pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard indisponível — usuário pode selecionar manualmente
    }
  }

  // Estado: PAGO
  if (phase === "paid") {
    return (
      <div className="min-h-dvh-100 flex items-center justify-center p-6 pt-safe pb-safe">
        <div className="text-center max-w-sm w-full">
          <div className="size-20 mx-auto mb-5 rounded-full border-4 border-mafood-success-strong/40 bg-mafood-success/10 grid place-items-center">
            <span className="text-4xl">✓</span>
          </div>
          <h2 className="mafood-display text-mafood-text-primary text-fluid-2xl">
            Pagamento confirmado
          </h2>
          <p className="num text-sm text-mafood-text-secondary mt-3">
            Aguardando o restaurante aceitar seu pedido
          </p>
          <button
            onClick={onFinalize}
            className="mt-6 w-full rounded-mafood-md bg-mafood-success-strong min-h-touch h-12 text-white font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
          >
            Acompanhar pedido
          </button>
        </div>
      </div>
    );
  }

  const expired = phase === "expired";

  return (
    <div className="min-h-dvh-100 p-4 sm:p-5 pt-safe pb-[88px]">
      <header className="flex items-center gap-3">
        <h1 className="mafood-display text-mafood-text-primary text-fluid-2xl">Pagamento Pix</h1>
      </header>
      <div className="mt-6 flex flex-col items-center text-center">
        <p className="num text-[11px] text-mafood-text-secondary">PEDIDO #{orderNumber}</p>
        <p
          className={`num text-sm ${expired ? "text-mafood-accent-dark" : "text-mafood-primary-strong"}`}
          aria-live="polite"
        >
          {expired ? "Pix expirado" : `expira em ${formatCountdown(seconds)}`}
        </p>

        <div className="relative bg-white p-3 rounded-mafood-md mt-4 shadow-lg">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR Code Pix" width={240} height={240} />
          ) : (
            <div className="size-[240px] grid place-items-center text-black/30 text-sm">
              Carregando QR…
            </div>
          )}
          {expired && (
            <div className="absolute inset-0 rounded-mafood-md bg-black/70 grid place-items-center">
              <span className="text-white num text-sm uppercase tracking-wider">Expirado</span>
            </div>
          )}
        </div>

        <p className="num text-fluid-2xl text-mafood-text-primary mt-4">{brl(finalTotal)}</p>
        {discount > 0 && (
          <p className="num text-xs text-mafood-success-strong mt-1">
            − {brl(discount)} de desconto aplicado
          </p>
        )}

        {expired ? (
          <button
            onClick={onRegenerate}
            className="mt-6 w-full max-w-xs rounded-mafood-md bg-mafood-primary-strong min-h-touch h-12 text-white font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
          >
            Gerar novo Pix
          </button>
        ) : (
          <>
            <p className="text-mafood-text-secondary text-sm mt-1">Escaneie no app do seu banco</p>
            {pixPayload && (
              <div className="mt-5 w-full max-w-xs space-y-2">
                <p className="num text-[10px] text-mafood-text-secondary uppercase tracking-wider">
                  Ou copie o código Pix:
                </p>
                <div className="flex items-center gap-2 rounded-mafood-md border border-mafood-border bg-mafood-surface-strong px-3 py-2">
                  <p className="num text-[11px] text-mafood-text-secondary flex-1 truncate text-left">
                    {pixPayload.slice(0, 38)}…
                  </p>
                  <button
                    onClick={() => void copyPix()}
                    className={`num shrink-0 rounded px-3 min-h-[36px] text-[11px] uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary ${
                      copied
                        ? "bg-mafood-success/20 text-mafood-success-strong"
                        : "bg-mafood-primary/15 text-mafood-primary-strong hover:bg-mafood-primary/25"
                    }`}
                  >
                    {copied ? "Copiado ✓" : "Copiar"}
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={onFinalize}
              className="mt-6 w-full max-w-xs rounded-mafood-md bg-mafood-success-strong min-h-touch h-12 text-white font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
            >
              Acompanhar pedido
            </button>
            <p className="num text-[10px] text-mafood-text-secondary mt-3">
              Esta tela confirma sozinha quando o pagamento cair
            </p>
          </>
        )}
      </div>
    </div>
  );
}
