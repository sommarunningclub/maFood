"use client";

import { useEffect } from "react";
import { X, Clock, CheckCircle2, CreditCard, MessageSquare, User } from "lucide-react";
import { brl, formatTime } from "@/lib/utils";

type Status = "pending" | "paid" | "preparing" | "ready" | "partial" | "delivered" | "cancelled";

interface OrderItem {
  id: string;
  product_id: string | null;
  name: string;
  qty: number;
  delivered_qty: number;
  unit_price: number;
  notes: string | null;
}

interface Order {
  id: string;
  number: number;
  customer_name: string;
  customer_cpf: string | null;
  total: number;
  method: "pix" | "card";
  status: Status;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  ready_at: string | null;
  items: OrderItem[];
}

const STATUS_LABEL: Record<Status, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago — aguardando preparo",
  preparing: "Em preparo",
  ready: "Pronto pra retirada",
  partial: "Retirada parcial",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_COLOR: Record<Status, string> = {
  pending: "text-palantir-muted",
  paid: "text-palantir-yellow",
  preparing: "text-palantir-blue",
  ready: "text-palantir-green",
  partial: "text-somma-orange",
  delivered: "text-palantir-muted",
  cancelled: "text-palantir-red",
};

export function OrderDetailModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const subtotal = order.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const totalPedidos = order.items.reduce((s, i) => s + i.qty, 0);
  const totalEntregues = order.items.reduce((s, i) => s + i.delivered_qty, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes do pedido #${order.number}`}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[85dvh] overflow-y-auto rounded-t-xl sm:rounded-admin border border-palantir-border bg-palantir-surface pb-safe"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-palantir-border bg-palantir-surface px-4 sm:px-5 py-3">
          <div className="min-w-0">
            <p className="mono text-[10px] tracking-widest text-palantir-muted">DETALHES DO PEDIDO</p>
            <h2 className="text-lg sm:text-xl font-semibold text-white mt-0.5">
              #{order.number}
            </h2>
            <p className={`mono text-[11px] uppercase tracking-wider mt-1 ${STATUS_COLOR[order.status]}`}>
              ● {STATUS_LABEL[order.status]}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-touch -mr-2 -mt-1 place-items-center text-palantir-muted hover:text-white focus-ring-admin"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-5">
          {/* Cliente */}
          <section>
            <SectionTitle icon={User} label="Cliente" />
            <p className="text-white text-base mt-1">{order.customer_name}</p>
            {order.customer_cpf && (
              <p className="mono text-xs text-palantir-muted mt-0.5">CPF: {order.customer_cpf}</p>
            )}
          </section>

          {/* Timeline */}
          <section>
            <SectionTitle icon={Clock} label="Linha do tempo" />
            <div className="mt-2 space-y-1 mono text-xs text-palantir-text">
              <TimelineRow label="Pedido criado" time={order.created_at} />
              {order.paid_at && <TimelineRow label="Pago" time={order.paid_at} />}
              {order.ready_at && <TimelineRow label="Pronto" time={order.ready_at} />}
            </div>
          </section>

          {/* Itens */}
          <section>
            <SectionTitle icon={CheckCircle2} label={`Itens (${totalEntregues}/${totalPedidos} entregues)`} />
            <ul className="mt-2 space-y-1.5">
              {order.items.map((it) => {
                const partial = it.delivered_qty > 0 && it.delivered_qty < it.qty;
                const fully = it.delivered_qty >= it.qty;
                return (
                  <li
                    key={it.id}
                    className="flex justify-between items-start gap-3 border-b border-palantir-border/50 pb-2 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${fully ? "line-through text-palantir-muted" : "text-palantir-text"}`}>
                        <span
                          className={`mono mr-1 ${
                            partial ? "text-somma-orange" : fully ? "text-palantir-muted" : "text-palantir-blue"
                          }`}
                        >
                          {partial || fully ? `${it.delivered_qty}/${it.qty}×` : `${it.qty}×`}
                        </span>
                        {it.name}
                      </p>
                      {it.notes && (
                        <p className="mono text-[10px] text-palantir-yellow mt-0.5 pl-4">
                          ↳ {it.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="mono text-xs text-palantir-text">{brl(it.unit_price)}</p>
                      <p className="mono text-[10px] text-palantir-muted">{brl(it.qty * it.unit_price)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Notas do pedido */}
          {order.notes && (
            <section>
              <SectionTitle icon={MessageSquare} label="Observações" />
              <p className="text-sm text-palantir-text mt-1 whitespace-pre-wrap">{order.notes}</p>
            </section>
          )}

          {/* Totais */}
          <section className="border-t border-palantir-border pt-3 space-y-1">
            <div className="flex justify-between mono text-xs text-palantir-muted">
              <span>Subtotal</span>
              <span>{brl(subtotal)}</span>
            </div>
            {subtotal !== order.total && (
              <div className="flex justify-between mono text-xs text-somma-green">
                <span>Desconto</span>
                <span>− {brl(subtotal - order.total)}</span>
              </div>
            )}
            <div className="flex justify-between mt-2 text-base font-semibold text-white">
              <span>Total</span>
              <span className="num">{brl(order.total)}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 mono text-[10px] uppercase tracking-wider text-palantir-muted">
              <CreditCard className="size-3" />
              {order.method === "pix" ? "Pix" : "Cartão de crédito"}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <h3 className="mono text-[10px] uppercase tracking-widest text-palantir-muted flex items-center gap-1.5">
      <Icon className="size-3" />
      {label}
    </h3>
  );
}

function TimelineRow({ label, time }: { label: string; time: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-palantir-blue">{formatTime(time)}</span>
      <span className="text-palantir-text">{label}</span>
    </div>
  );
}
