"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Trash2, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { PdvLogo } from "@/components/pdv-logo";
import { brl, formatTime } from "@/lib/utils";

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
  const [orders, setOrders] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancelOrder(id: string) {
    if (!window.confirm("Cancelar este pedido? Esta ação não pode ser desfeita.")) return;
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
    if (!window.confirm("Remover este pedido permanentemente? Ele sairá da sua lista.")) return;
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
    <div className="min-h-dvh-100 p-4 sm:p-5 pt-safe somma-grain">
      <header className="flex items-center gap-3">
        <Link
          href={`/${venue}`}
          aria-label="Voltar à praça"
          className="grid size-touch -ml-2 place-items-center text-somma-muted hover:text-white focus-ring"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-fluid-2xl text-white font-display uppercase tracking-wide">
          Meus pedidos
        </h1>
      </header>

      {error && (
        <p
          role="alert"
          className="num mt-4 text-xs text-somma-red border border-somma-red/30 bg-somma-red/10 px-3 py-2 rounded-client"
        >
          {error}
        </p>
      )}

      {orders.length === 0 ? (
        <div className="mt-20 text-center text-somma-muted">
          <p className="text-5xl mb-3">🧾</p>
          <p>Nenhum pedido ainda</p>
          <Link
            href={`/${venue}`}
            className="num mt-4 inline-block text-somma-orange underline text-sm"
          >
            Ver praça de alimentação
          </Link>
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
                className={`rounded-client border p-4 ${
                  isPending
                    ? "border-somma-orange/60 bg-somma-orange/10 animate-pulse-orange"
                    : isCancelled
                    ? "border-somma-border bg-somma-surface opacity-70"
                    : "border-somma-border bg-somma-surface"
                }`}
              >
                {/* Área clicável → tracker */}
                <Link
                  href={`/${venue}/order/${o.id}`}
                  className="block active:scale-[0.99] transition-transform focus-ring rounded-client"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <PdvLogo logoUrl={o.pdv_logo} size={28} />
                      <div>
                        <p className="text-white font-medium">{o.pdv_name}</p>
                        <p className="num text-[11px] text-somma-muted">
                          #{o.number} · {formatTime(o.created_at)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  {isPending && (
                    <p className="num text-[11px] text-somma-orange mt-2 font-semibold uppercase tracking-wide">
                      💳 Pagar agora →
                    </p>
                  )}
                  <div className="flex justify-between items-end mt-2">
                    <p className="num text-xs text-somma-muted">
                      {o.method.toUpperCase()}
                      {o.created_by === "pdv" && (
                        <span className="ml-2 text-somma-muted/60">· criado pelo PDV</span>
                      )}
                    </p>
                    <p className="num font-semibold text-somma-orange">{brl(o.total)}</p>
                  </div>
                </Link>

                {/* Ações — só para não pagos */}
                {canDelete && (
                  <div className="mt-3 pt-3 border-t border-somma-border/60 flex items-center gap-2">
                    {isPending && (
                      <button
                        onClick={() => void cancelOrder(o.id)}
                        disabled={busy}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-client border border-somma-border min-h-touch h-10 text-somma-muted hover:text-somma-orange hover:border-somma-orange/40 num text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50 focus-ring"
                      >
                        <XCircle className="size-3.5" />
                        {busy ? "..." : "Cancelar"}
                      </button>
                    )}
                    <button
                      onClick={() => void removeOrder(o.id)}
                      disabled={busy}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-client border border-somma-border min-h-touch h-10 text-somma-muted hover:text-somma-red hover:border-somma-red/40 num text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50 focus-ring"
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
