"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { brl, formatTime } from "@/lib/utils";

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
  const [qr, setQr] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    const supabase = createClient();
    const { data: o } = await supabase
      .from("orders")
      .select("id, number, customer_name, total, status, created_at, paid_at, ready_at, pdv_id")
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
    if (order)
      QRCode.toDataURL(`MAFOOD-PICKUP-${order.number}`, { width: 160, margin: 1 }).then(setQr);
  }, [order]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-somma-muted">
        carregando pedido...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-somma-muted">Pedido não encontrado</p>
        <Link href={`/${venue}`} className="text-somma-orange num text-sm underline">
          Voltar à praça
        </Link>
      </div>
    );
  }

  const rank = RANK[order.status];
  const isReady = order.status === "ready" || order.status === "partial";
  const isPartial = order.status === "partial";
  const totalPedidos = order.items.reduce((s, i) => s + i.qty, 0);
  const totalEntregues = order.items.reduce((s, i) => s + i.delivered_qty, 0);

  return (
    <div className="min-h-screen p-5 somma-grain">
      <header className="flex items-center justify-between">
        <Link href={`/${venue}`} className="text-somma-muted text-xl">
          ←
        </Link>
        <p className="num text-[11px] text-somma-muted">#{order.number}</p>
      </header>

      <div className="mt-4 text-center">
        <p className="num text-[11px] text-somma-muted">{order.pdv_name}</p>
        <h1 className="text-3xl text-white font-display uppercase mt-1">
          {isReady
            ? isPartial
              ? "Retirada parcial"
              : "Pedido pronto!"
            : "Acompanhe seu pedido"}
        </h1>
      </div>

      {isReady && (
        <motion.div
          className="mx-auto mt-5 size-20 rounded-full bg-somma-orange flex items-center justify-center text-3xl animate-pulse-orange"
        >
          🔔
        </motion.div>
      )}

      {/* Timeline */}
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
