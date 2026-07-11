"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, formatTime } from "@/lib/utils";
import { PizzaLoader } from "@/components/customer/pizza-loader";

type Status = "pending" | "paid" | "preparing" | "ready" | "partial" | "delivered" | "cancelled";

interface OrderItem {
  id: string;
  name: string;
  qty: number;
  delivered_qty: number;
  unit_price: number;
  notes: string | null;
}

interface Order {
  id: string;
  number: number;
  pdv_name: string;
  customer_name: string;
  total: number;
  status: Status;
  created_at: string;
  paid_at: string | null;
  ready_at: string | null;
  items: OrderItem[];
  pix_payload: string | null;
  pix_qr_code: string | null;
  created_by: "customer" | "pdv";
}

const STEPS: { status: Status; label: string }[] = [
  { status: "paid", label: "Pago" },
  { status: "preparing", label: "Em preparo" },
  { status: "ready", label: "Pronto" },
  { status: "delivered", label: "Entregue" },
];
const RANK: Record<Status, number> = {
  pending: -1,
  paid: 0,
  preparing: 1,
  ready: 2,
  partial: 2.5, // entre pronto e entregue
  delivered: 3,
  cancelled: -1,
};

export function OrderTracker({ venue, orderId }: { venue: string; orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    const supabase = createClient();
    const { data: o } = await supabase
      .from("orders")
      .select(
        "id, number, customer_name, total, status, created_at, paid_at, ready_at, pdv_id, pix_payload, pix_qr_code, created_by"
      )
      .eq("id", orderId)
      .maybeSingle();
    if (!o) {
      setLoading(false);
      return;
    }
    const [{ data: items }, { data: pdv }] = await Promise.all([
      supabase
        .from("order_items")
        .select("id, name, qty, delivered_qty, unit_price, notes")
        .eq("order_id", orderId),
      supabase.from("pdvs").select("name").eq("id", o.pdv_id).maybeSingle(),
    ]);
    setOrder({
      id: o.id,
      number: o.number,
      pdv_name: pdv?.name ?? "PDV",
      customer_name: o.customer_name,
      total: Number(o.total),
      status: o.status as Status,
      created_at: o.created_at,
      paid_at: o.paid_at,
      ready_at: o.ready_at,
      items: (items ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        delivered_qty: i.delivered_qty,
        unit_price: Number(i.unit_price),
        notes: i.notes,
      })),
      pix_payload: o.pix_payload ?? null,
      pix_qr_code: o.pix_qr_code ?? null,
      created_by: (o.created_by ?? "customer") as "customer" | "pdv",
    });
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    const supabase = createClient();
    const ch = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "mafood", table: "orders", filter: `id=eq.${orderId}` },
        () => fetchOrder()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "mafood", table: "order_items", filter: `order_id=eq.${orderId}` },
        () => fetchOrder()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchOrder, orderId]);

  useEffect(() => {
    if (!order) return;
    // Status pending: gera QR do pix_payload (cobrança). Outros: QR de retirada.
    if (order.status === "pending") {
      if (order.pix_qr_code) {
        // base64 vindo do Asaas — já é image data
        setQr(
          order.pix_qr_code.startsWith("data:")
            ? order.pix_qr_code
            : `data:image/png;base64,${order.pix_qr_code}`
        );
      } else if (order.pix_payload) {
        QRCode.toDataURL(order.pix_payload, { width: 240, margin: 1 }).then(setQr);
      }
    } else {
      QRCode.toDataURL(`MAFOOD-PICKUP-${order.number}`, { width: 160, margin: 1 }).then(setQr);
    }
  }, [order]);

  if (loading) {
    return (
      <div className="min-h-dvh-100 flex items-center justify-center text-somma-muted pt-safe pb-safe">
        <div className="text-center">
          <div className="size-10 mx-auto mb-3 rounded-full border-2 border-somma-border border-t-somma-orange animate-spin" />
          carregando pedido...
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-dvh-100 flex flex-col items-center justify-center gap-3 p-8 text-center pt-safe pb-safe">
        <p className="text-somma-muted">Pedido não encontrado</p>
        <Link
          href={`/${venue}`}
          className="text-somma-orange num text-sm underline min-h-touch inline-flex items-center px-3 focus-ring"
        >
          Voltar à praça
        </Link>
      </div>
    );
  }

  const rank = RANK[order.status];
  const isReady = order.status === "ready" || order.status === "partial";
  const isPartial = order.status === "partial";
  const isPending = order.status === "pending";
  const isPreparing = order.status === "preparing";
  const totalPedidos = order.items.reduce((s, i) => s + i.qty, 0);
  const totalEntregues = order.items.reduce((s, i) => s + i.delivered_qty, 0);

  async function refreshNow() {
    setRefreshing(true);
    try {
      await fetchOrder();
    } finally {
      // pequeno atraso pra UX (botão não pisca em conexão rápida)
      setTimeout(() => setRefreshing(false), 400);
    }
  }

  async function copyPix() {
    if (!order?.pix_payload) return;
    try {
      await navigator.clipboard.writeText(order.pix_payload);
    } catch {}
  }

  async function cancelOrder() {
    if (!order) return;
    if (!window.confirm("Cancelar este pedido? Esta ação não pode ser desfeita.")) return;
    setCancelError(null);
    setCancelling(true);
    try {
      const r = await fetch(`/api/customer/orders/${order.id}/cancel`, { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setCancelError(data.error ?? "Não foi possível cancelar");
        return;
      }
      await fetchOrder();
    } finally {
      setCancelling(false);
    }
  }

  const isCancelled = order.status === "cancelled";

  return (
    <div className="min-h-dvh-100 p-4 sm:p-5 pt-safe pb-safe somma-grain">
      <header className="flex items-center justify-between">
        <Link
          href={`/${venue}`}
          aria-label="Voltar à praça"
          className="grid size-touch -ml-2 place-items-center text-somma-muted hover:text-white focus-ring"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <p className="num text-[11px] text-somma-muted">#{order.number}</p>
      </header>

      <div className="mt-4 text-center">
        <p className="num text-[11px] text-somma-muted">{order.pdv_name}</p>
        <h1 className="text-fluid-2xl text-white font-display uppercase mt-1">
          {isCancelled
            ? "Pedido cancelado"
            : isPending
            ? "Aguardando pagamento"
            : isPreparing
            ? "Em preparo"
            : isReady
            ? isPartial
              ? "Retirada parcial"
              : "Pedido pronto!"
            : "Acompanhe seu pedido"}
        </h1>
        {order.created_by === "pdv" && isPending && (
          <p className="num text-[11px] text-somma-muted mt-1">
            Pedido criado pelo balcão — pague para liberar o preparo
          </p>
        )}
      </div>

      {/* Bloco "aguarde + atualizar" — visível enquanto pedido não está pronto/entregue */}
      {(order.status === "paid" || isPreparing) && (
        <section className="mt-6 flex flex-col items-center text-center">
          {isPreparing && (
            <div className="opacity-90">
              <PizzaLoader size={96} />
            </div>
          )}
          <p className="num text-[11px] text-somma-muted mt-3 max-w-xs">
            {isPreparing
              ? "Atualize aqui para saber a hora de retirar o seu pedido"
              : "Aguardando o PDV aceitar — atualize para saber se já começou o preparo"}
          </p>
          <button
            onClick={refreshNow}
            disabled={refreshing}
            className="mt-3 inline-flex items-center gap-2 rounded-client bg-somma-orange/15 border border-somma-orange/40 text-somma-orange min-h-touch px-4 num text-xs uppercase tracking-wider focus-ring disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
        </section>
      )}

      {/* Bloco de pagamento Pix (status pending) */}
      {isPending && (
        <section className="mt-6 rounded-client border border-somma-orange/40 bg-somma-orange/5 p-4 flex flex-col items-center">
          <p className="num text-[11px] text-somma-orange tracking-widest uppercase">Pix · maFood</p>
          <p className="num text-3xl text-white font-bold mt-1">{brl(order.total)}</p>
          {qr ? (
            <div className="bg-white p-3 rounded-client mt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR Code Pix" width={240} height={240} className="max-w-[60vw]" />
            </div>
          ) : (
            <div className="size-60 grid place-items-center text-somma-muted text-sm mt-4">
              gerando QR...
            </div>
          )}
          {order.pix_payload && (
            <div className="w-full mt-4">
              <p className="num text-[10px] uppercase text-somma-muted mb-1">Pix copia-cola</p>
              <div className="flex gap-2">
                <code className="num flex-1 truncate rounded-client border border-somma-border bg-somma-bg px-2 py-2 text-[11px] text-somma-text">
                  {order.pix_payload}
                </code>
                <button
                  onClick={copyPix}
                  className="num min-h-touch px-3 rounded-client bg-somma-orange text-white text-xs font-semibold focus-ring"
                >
                  Copiar
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-somma-muted text-center mt-3">
            Pague pelo app do seu banco. Esta tela atualiza sozinha quando a cobrança for confirmada.
          </p>
        </section>
      )}

      {/* Cancelar pedido — só enquanto não foi pago */}
      {isPending && (
        <section className="mt-4">
          {cancelError && (
            <p
              role="alert"
              className="num text-xs text-somma-red text-center mb-2 border border-somma-red/30 bg-somma-red/10 px-3 py-2 rounded-client"
            >
              {cancelError}
            </p>
          )}
          <button
            onClick={cancelOrder}
            disabled={cancelling}
            className="w-full inline-flex items-center justify-center gap-2 rounded-client border border-somma-border min-h-touch h-11 text-somma-muted hover:text-somma-red hover:border-somma-red/40 num text-xs uppercase tracking-widest transition-colors disabled:opacity-50 focus-ring"
          >
            {cancelling ? "Cancelando…" : "Cancelar pedido"}
          </button>
          <p className="num text-[10px] text-somma-muted text-center mt-2">
            O cancelamento só é permitido antes do pagamento
          </p>
        </section>
      )}

      {/* Estado cancelado */}
      {isCancelled && (
        <section className="mt-6 rounded-client border border-somma-red/30 bg-somma-red/5 p-5 text-center">
          <div className="mx-auto size-14 rounded-full bg-somma-red/10 border border-somma-red/30 grid place-items-center text-2xl">
            ✕
          </div>
          <p className="text-white font-display uppercase tracking-wide mt-3">
            Pedido cancelado
          </p>
          <p className="num text-[11px] text-somma-muted mt-1">
            Nenhum valor foi cobrado.
          </p>
          <Link
            href={`/${venue}`}
            className="num mt-4 inline-flex items-center justify-center rounded-client bg-somma-orange min-h-touch h-11 px-5 text-white text-xs uppercase tracking-wide focus-ring"
          >
            Fazer novo pedido
          </Link>
        </section>
      )}

      {isReady && (
        <motion.div
          className="mx-auto mt-5 size-20 rounded-full bg-somma-orange flex items-center justify-center text-3xl animate-pulse-orange"
        >
          🔔
        </motion.div>
      )}

      {/* Timeline — oculta quando cancelado */}
      {!isCancelled && (
      <div className="mt-8 space-y-0">
        {STEPS.map((step, i) => {
          const done = rank >= RANK[step.status];
          const current = order.status === step.status || (isPartial && step.status === "ready");
          return (
            <div key={step.status} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`size-9 rounded-full flex items-center justify-center num text-sm border-2 transition-colors ${
                    done
                      ? "bg-somma-orange border-somma-orange text-white"
                      : "border-somma-border text-somma-muted"
                  } ${current ? "ring-4 ring-somma-orange/20" : ""}`}
                >
                  {done ? "✓" : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-0.5 h-10 ${
                      rank > RANK[step.status] ? "bg-somma-orange" : "bg-somma-border"
                    }`}
                  />
                )}
              </div>
              <div className="pt-1">
                <p
                  className={`font-display uppercase tracking-wide ${
                    done ? "text-white" : "text-somma-muted"
                  }`}
                >
                  {step.label}
                </p>
                {current && (
                  <p className="num text-[11px] text-somma-orange">
                    {formatTime(new Date())}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* QR de retirada */}
      {isReady && qr && (
        <div className="mt-6 flex flex-col items-center">
          <p className="num text-[11px] text-somma-muted mb-2">
            Mostre na retirada · CPF: {order.customer_name}
          </p>
          <div className="bg-white p-2 rounded-client">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR retirada" width={140} height={140} />
          </div>
        </div>
      )}

      {isPartial && (
        <div className="mt-4 rounded-client border border-somma-orange/40 bg-somma-orange/10 px-3 py-2 text-center">
          <p className="num text-xs text-somma-orange">
            Entregue {totalEntregues}/{totalPedidos} itens · volte ao PDV para retirar o resto
          </p>
        </div>
      )}

      {/* Itens */}
      <div className="mt-8 rounded-client border border-somma-border bg-somma-surface p-4">
        {order.items.map((it) => {
          const partial = it.delivered_qty > 0 && it.delivered_qty < it.qty;
          const fully = it.delivered_qty >= it.qty;
          return (
            <div key={it.id} className="flex justify-between text-sm py-1">
              <span className={`text-somma-text ${fully ? "line-through text-somma-muted" : ""}`}>
                <span
                  className={`num ${
                    fully ? "text-somma-muted" : partial ? "text-somma-orange" : "text-somma-orange"
                  }`}
                >
                  {partial || fully ? `${it.delivered_qty}/${it.qty}` : it.qty}×
                </span>{" "}
                {it.name}
              </span>
              <span className="num text-somma-muted">{brl(it.qty * it.unit_price)}</span>
            </div>
          );
        })}
        <div className="flex justify-between text-white font-semibold border-t border-somma-border mt-2 pt-2">
          <span>Total</span>
          <span className="num">{brl(order.total)}</span>
        </div>
      </div>

      <p className="num text-[10px] text-somma-muted text-center mt-4">
        atualizando em tempo real
      </p>
    </div>
  );
}
