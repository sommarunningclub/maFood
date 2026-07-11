"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Trash2, XCircle, Receipt } from "lucide-react";
import { OrderStatusBadge } from "@/components/customer/order-status-badge";
import { PdvLogo } from "@/components/pdv-logo";
import { brl, formatTime } from "@/lib/utils";
import { EmptyState } from "@/components/customer/ui/mafood-states";
import { useConfirm } from "@/components/customer/ui/confirm-sheet";

type Status = "pending" | "paid" | "preparing" | "ready" | "partial" | "delivered" | "cancelled";

export interface OrderRow {
  id: string;
  number: number;
  total: number;
  method: string;
  status: Status;
  created_at: string;
  created_by: string;
  pdv_name: string;
  pdv_logo: string | null;
}

export function OrdersHistoryView({
  venue,
  orders: initial,
}: {
  venue: string;
  orders: OrderRow[];
}) {
  const router = useRouter();
  const { confirm, confirmElement } = useConfirm();
  const [orders, setOrders] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancelOrder(id: string) {
    const ok = await confirm({
      title: "Cancelar pedido?",
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Cancelar pedido",
      cancelLabel: "Voltar",
      destructive: true,
    });
    if (!ok) return;
    setError(null);
    setBusyId(id);
    try {
      const r = await fetch(`/api/customer/orders/${id}/cancel`, { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error ?? "Não foi possível cancelar");
        return;
      }
      setOrders((list) =>
        list.map((o) => (o.id === id ? { ...o, status: "cancelled" as Status } : o))
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function removeOrder(id: string) {
    const ok = await confirm({
      title: "Remover pedido?",
      description: "Ele sairá permanentemente da sua lista.",
      confirmLabel: "Remover",
      cancelLabel: "Voltar",
      destructive: true,
    });
    if (!ok) return;
    setError(null);
    setBusyId(id);
    try {
      const r = await fetch(`/api/customer/orders/${id}`, { method: "DELETE" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error ?? "Não foi possível remover");
        return;
      }
      setOrders((list) => list.filter((o) => o.id !== id));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-dvh-100 p-4 sm:p-5 pt-safe">
      {confirmElement}
      <header className="flex items-center gap-3">
        <Link
          href={`/${venue}`}
          aria-label="Voltar à praça"
          className="grid size-touch -ml-2 place-items-center text-mafood-text-secondary hover:text-mafood-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="mafood-display text-fluid-2xl text-mafood-text-primary">
          Meus pedidos
        </h1>
      </header>

      {error && (
        <p
          role="alert"
          className="num mt-4 text-xs text-mafood-accent-dark border border-mafood-accent-dark/30 bg-mafood-accent-dark/10 px-3 py-2 rounded-mafood-md"
        >
          {error}
        </p>
      )}

      {orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={Receipt} title="Nenhum pedido ainda" />
          <div className="text-center">
            <Link
              href={`/${venue}`}
              className="num mt-2 inline-block text-mafood-primary-strong underline text-sm"
            >
              Ver praça de alimentação
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {orders.map((o) => {
            const isPending = o.status === "pending";
            const isCancelled = o.status === "cancelled";
            const canDelete = isPending || isCancelled;
            const busy = busyId === o.id;

            return (
              <div
                key={o.id}
                className={`rounded-mafood-md border p-4 ${
                  isPending
                    ? "border-mafood-primary/60 bg-mafood-primary/10 animate-pulse-primary"
                    : isCancelled
                    ? "border-mafood-border bg-mafood-surface-strong opacity-70"
                    : "border-mafood-border bg-mafood-surface-strong"
                }`}
              >
                {/* Área clicável → tracker */}
                <Link
                  href={`/${venue}/order/${o.id}`}
                  className="block active:scale-[0.99] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary rounded-mafood-md"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 min-w-0">
                      <PdvLogo logoUrl={o.pdv_logo} size={28} />
                      <div className="min-w-0">
                        <p className="text-mafood-text-primary font-medium truncate">{o.pdv_name}</p>
                        <p className="num text-[11px] text-mafood-text-secondary">
                          #{o.number} · {formatTime(o.created_at)}
                        </p>
                      </div>
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  {isPending && (
                    <p className="num text-[11px] text-mafood-primary-strong mt-2 font-semibold uppercase tracking-wide">
                      💳 Pagar agora →
                    </p>
                  )}
                  <div className="flex justify-between items-end mt-2">
                    <p className="num text-xs text-mafood-text-secondary">
                      {o.method.toUpperCase()}
                      {o.created_by === "pdv" && (
                        <span className="ml-2 text-mafood-text-secondary/60">· criado pelo PDV</span>
                      )}
                    </p>
                    <p className="num font-semibold text-mafood-primary-strong">{brl(o.total)}</p>
                  </div>
                </Link>

                {/* Ações — só para não pagos */}
                {canDelete && (
                  <div className="mt-3 pt-3 border-t border-mafood-border/60 flex items-center gap-2">
                    {isPending && (
                      <button
                        onClick={() => void cancelOrder(o.id)}
                        disabled={busy}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-mafood-md border border-mafood-border min-h-touch h-10 text-mafood-text-secondary hover:text-mafood-primary-strong hover:border-mafood-primary/40 num text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
                      >
                        <XCircle className="size-3.5" />
                        {busy ? "..." : "Cancelar"}
                      </button>
                    )}
                    <button
                      onClick={() => void removeOrder(o.id)}
                      disabled={busy}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-mafood-md border border-mafood-border min-h-touch h-10 text-mafood-text-secondary hover:text-mafood-accent-dark hover:border-mafood-accent-dark/40 num text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
                    >
                      <Trash2 className="size-3.5" />
                      {busy ? "..." : "Remover"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
