# Refino do pagamento de bebidas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refinar o retorno ao usuário durante o pagamento de bebidas: cartão com loading mínimo de 3s + tela de aprovado/negado, e PIX com expiração real e detecção automática de pagamento na tela.

**Architecture:** Todas as mudanças de UI concentram-se em `src/components/customer/checkout-view.tsx`, com a tela de PIX extraída para `src/components/customer/pix-payment.tsx`. A detecção de pagamento reaproveita o padrão de Supabase Realtime já usado em `order-tracker.tsx` (canal `order-${orderId}` no schema `mafood`), com polling de reforço. Lógica pura (formatação de contador, checagem de status pago) vai para `src/lib/pix.ts` com testes vitest.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Zustand, Supabase Realtime (`@/lib/supabase/client`), Tailwind (tokens `mafood-*`), `qrcode`, vitest.

## Global Constraints

- Gateway é Asaas; a confirmação de pagamento vem por webhook que atualiza `orders.status` no schema `mafood`. O cliente **não** confirma pagamento — apenas observa o status.
- Schema Supabase do cliente browser: `mafood` (via `createClient` de `@/lib/supabase/client`).
- Copy da próxima etapa (verbatim): **"Aguardando o restaurante aceitar seu pedido"**.
- Tempo de expiração do PIX: **15 minutos** (900 s).
- Polling de reforço do PIX: intervalo de **4000 ms**.
- Delay mínimo da tela de processamento do cartão: **3000 ms**.
- Manter padrões visuais existentes (classes `mafood-*`, `min-h-touch`, `focus-visible:outline`).
- Testes rodam com `npx vitest run`.

---

### Task 1: Helpers puros de PIX (`src/lib/pix.ts`)

**Files:**
- Create: `src/lib/pix.ts`
- Test: `src/lib/pix.test.ts`

**Interfaces:**
- Produces:
  - `formatCountdown(totalSeconds: number): string` → `"MM:SS"` (zero-padded; nunca negativo).
  - `isPaidStatus(status: string | null | undefined): boolean` → true quando o pedido saiu de `pending`/`cancelled` para um estado pago ou além (`paid`, `preparing`, `ready`, `partial`, `delivered`).
  - `PIX_EXPIRY_SECONDS: number` (= 900).
  - `PIX_POLL_MS: number` (= 4000).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pix.test.ts
import { describe, it, expect } from "vitest";
import { formatCountdown, isPaidStatus, PIX_EXPIRY_SECONDS, PIX_POLL_MS } from "./pix";

describe("formatCountdown", () => {
  it("formata MM:SS com zero-padding", () => {
    expect(formatCountdown(900)).toBe("15:00");
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(9)).toBe("00:09");
  });
  it("nunca retorna negativo", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5)).toBe("00:00");
  });
});

describe("isPaidStatus", () => {
  it("true para pago ou além", () => {
    for (const s of ["paid", "preparing", "ready", "partial", "delivered"]) {
      expect(isPaidStatus(s)).toBe(true);
    }
  });
  it("false para pending/cancelled/nulo", () => {
    expect(isPaidStatus("pending")).toBe(false);
    expect(isPaidStatus("cancelled")).toBe(false);
    expect(isPaidStatus(null)).toBe(false);
    expect(isPaidStatus(undefined)).toBe(false);
  });
});

describe("constantes", () => {
  it("valores esperados", () => {
    expect(PIX_EXPIRY_SECONDS).toBe(900);
    expect(PIX_POLL_MS).toBe(4000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pix.test.ts`
Expected: FAIL — `Cannot find module './pix'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/pix.ts
export const PIX_EXPIRY_SECONDS = 900;
export const PIX_POLL_MS = 4000;

const PAID_OR_BEYOND = new Set(["paid", "preparing", "ready", "partial", "delivered"]);

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function isPaidStatus(status: string | null | undefined): boolean {
  return status != null && PAID_OR_BEYOND.has(status);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pix.test.ts`
Expected: PASS (todos os testes verdes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pix.ts src/lib/pix.test.ts
git commit -m "feat(pix): pure helpers for countdown format and paid-status check"
```

---

### Task 2: Componente `PixPayment` (extração + expiração + detecção de pagamento)

**Files:**
- Create: `src/components/customer/pix-payment.tsx`
- Modify: `src/components/customer/checkout-view.tsx` (remover bloco inline do PIX `if (step === "pix")` incluindo `PixTimer`; passar a renderizar `<PixPayment .../>`)

**Interfaces:**
- Consumes (de Task 1): `formatCountdown`, `isPaidStatus`, `PIX_EXPIRY_SECONDS`, `PIX_POLL_MS` de `@/lib/pix`; `createClient` de `@/lib/supabase/client`.
- Produces:
  ```ts
  interface PixPaymentProps {
    venue: string;
    orderId: string;
    orderNumber: number | null;
    qr: string | null;
    pixPayload: string | null;
    finalTotal: number;
    discount: number;
    onRegenerate: () => void;   // pai chama submitOrder() de novo
    onFinalize: () => void;     // pai limpa carrinho e roteia p/ tracker
  }
  export function PixPayment(props: PixPaymentProps): JSX.Element;
  ```
- Comportamento interno:
  - Estado local `phase: "waiting" | "paid" | "expired"`.
  - Contador iniciando em `PIX_EXPIRY_SECONDS`, decremento por `setInterval` de 1 s; ao chegar a 0 e ainda `waiting`, muda para `expired`.
  - Realtime: canal `order-${orderId}`, `postgres_changes` em `{ event: "*", schema: "mafood", table: "orders", filter: `id=eq.${orderId}` }` → ao evento, refaz `select status`.
  - Polling: `setInterval(PIX_POLL_MS)` fazendo `supabase.from("orders").select("status").eq("id", orderId).maybeSingle()`.
  - Se `isPaidStatus(status)` → `phase = "paid"` (tem prioridade sobre `expired`). Limpa timer, realtime e polling no unmount.
  - Botão copiar: `navigator.clipboard.writeText(pixPayload)` com feedback `copied` por 2.5 s (igual ao atual).

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/customer/pix-payment.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .maybeSingle();
    if (data && isPaidStatus(data.status)) setPhase("paid");
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

  // Realtime + polling de reforço
  useEffect(() => {
    void checkStatus();
    const supabase = createClient();
    const ch = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "mafood", table: "orders", filter: `id=eq.${orderId}` },
        () => void checkStatus()
      )
      .subscribe();
    const poll = setInterval(() => void checkStatus(), PIX_POLL_MS);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, [orderId, checkStatus]);

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
```

- [ ] **Step 2: Substituir o bloco inline do PIX em `checkout-view.tsx`**

Em `src/components/customer/checkout-view.tsx`, remover todo o bloco `if (step === "pix") { ... }` (que hoje inclui a função interna `copyPix`, o QR, o payload e `<PixTimer />`) e também remover a função `PixTimer` do fim do arquivo. Substituir o bloco `if (step === "pix")` por:

```tsx
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
        onRegenerate={() => void submitOrder()}
        onFinalize={finalize}
      />
    );
  }
```

Adicionar o import no topo:

```tsx
import { PixPayment } from "@/components/customer/pix-payment";
```

Remover o import agora não usado, se aplicável: `QRCode` continua sendo usado em `submitOrder` (fallback do QR), então **mantém**. `useEffect` deixa de ser usado por `PixTimer` mas ainda pode ser usado em outros pontos — verificar; se ficar sem uso, remover de `import { useEffect, useState }`. (Após esta edição, `useEffect` não é mais usado em `checkout-view.tsx` → trocar para `import { useState } from "react";`.)

- [ ] **Step 3: Verificar build/typecheck e testes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; testes existentes + `pix.test.ts` passam.

- [ ] **Step 4: Commit**

```bash
git add src/components/customer/pix-payment.tsx src/components/customer/checkout-view.tsx
git commit -m "feat(pix): extract PixPayment with real expiry + auto paid-detection"
```

---

### Task 3: Cartão — loading de 3s + tela de aprovado

**Files:**
- Modify: `src/components/customer/checkout-view.tsx`

**Interfaces:**
- Consumes: `submitOrder`, `finalize`, `Step` type já existentes.
- Produces: novo valor de `Step` `"approved"`; render branch para `step === "approved"`.

- [ ] **Step 1: Estender o tipo `Step`**

Trocar a definição:

```tsx
type Step = "form" | "card-form" | "submitting" | "pix" | "approved" | "failed";
```

- [ ] **Step 2: Aumentar o delay mínimo para 3s**

Em `submitOrder`, trocar a linha do `minDelay` (hoje `setTimeout(res, 1000)`) por:

```tsx
    // Delay mínimo 3s — UX: garante que o usuário veja "Processando..." e
    // tenha um retorno claro de aprovado/negado mesmo se o Asaas responder rápido.
    const minDelay = new Promise<void>((res) => setTimeout(res, 3000));
```

- [ ] **Step 3: Rotear cartão aprovado para a tela `approved`**

No ramo `else` de `submitOrder` (método cartão), trocar:

```tsx
    } else {
      // Cartão: independente de paid/pending, manda pro tracker (Realtime atualiza)
      clear();
      router.push(`/${venue}/order/${data.order_id}`);
    }
```

por:

```tsx
    } else {
      // Cartão aprovado: mostra confirmação explícita antes do tracker.
      setStep("approved");
    }
```

- [ ] **Step 4: Adicionar a tela `approved`**

Adicionar, junto aos outros branches de step (por ex. logo antes de `if (step === "failed")`):

```tsx
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
```

- [ ] **Step 5: Typecheck + testes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros; testes verdes.

- [ ] **Step 6: Commit**

```bash
git add src/components/customer/checkout-view.tsx
git commit -m "feat(card): 3s processing floor + explicit approved screen"
```

---

### Task 4: Verificação manual do fluxo

**Files:** nenhum (verificação).

- [ ] **Step 1: Rodar o app e exercitar os fluxos**

Run: `npm run dev` (ou skill `run`). Em modo simulação do Asaas (`ASAAS_API_KEY` ausente) ou sandbox:
- Cartão: submeter → confirmar que "Processando pagamento" fica visível ~3s → tela verde "Pagamento aprovado" com a próxima etapa e botão "Acompanhar pedido".
- Cartão negado (dados inválidos que o Asaas rejeite): cai na tela `failed`.
- PIX: gerar → conferir contador regressivo e botão copiar. Simular pagamento (atualizar `orders.status` para `paid` no Supabase) → tela troca sozinha para "Pagamento confirmado".
- PIX expirado: reduzir `PIX_EXPIRY_SECONDS` temporariamente para 5 e confirmar overlay "Expirado" + "Gerar novo Pix" gera novo QR (reverter o valor depois).

- [ ] **Step 2: Confirmar limpeza**

Verificar que `PixTimer` foi removido de `checkout-view.tsx` e não há imports órfãos (`npx tsc --noEmit` limpo).
