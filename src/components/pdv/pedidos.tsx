"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

const COLUMNS: {
  status: Status;
  label: string;
  accent: string;
  next?: Status;
  cta?: string;
}[] = [
  { status: "paid", label: "NOVOS", accent: "text-palantir-yellow border-palantir-yellow", next: "preparing", cta: "ACEITAR" },
  { status: "preparing", label: "EM PREPARO", accent: "text-palantir-blue border-palantir-blue", next: "ready", cta: "MARCAR PRONTO" },
  { status: "ready", label: "PRONTOS", accent: "text-palantir-green border-palantir-green" },
  { status: "partial", label: "PARCIAL", accent: "text-palantir-orange border-somma-orange" },
  { status: "delivered", label: "ENTREGUES", accent: "text-palantir-muted border-palantir-muted" },
];

export function Pedidos({ slug }: { slug: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [delivering, setDelivering] = useState<Order | null>(null);
  const beepRef = useRef<(() => void) | null>(null);
  const prevNewIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    beepRef.current = () => {
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        o.start();
        o.stop(ctx.currentTime + 0.3);
      } catch {}
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/pdv/orders");
      if (!r.ok) throw new Error("Falha ao carregar pedidos");
      const data = (await r.json()) as { orders: Order[] };
      setOrders(data.orders);

      // beep quando aparecer pedido novo (status paid) que ainda não estava na lista
      const newPaidIds = data.orders.filter((o) => o.status === "paid").map((o) => o.id);
      const novosDesconhecidos = newPaidIds.filter((id) => !prevNewIds.current.has(id));
      if (prevNewIds.current.size > 0 && novosDesconhecidos.length > 0) {
        beepRef.current?.();
      }
      prevNewIds.current = new Set(newPaidIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Realtime: assina mudanças em orders e order_items do schema mafood
    const supabase = createClient();
    const channel = supabase
      .channel("pdv-orders-" + slug)
      .on(
        "postgres_changes",
        { event: "*", schema: "mafood", table: "orders" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "mafood", table: "order_items" },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, slug]);

  const filtered = useMemo(() => {
    if (!query.trim()) return orders;
    const q = query.toLowerCase().replace(/\D/g, "");
    const text = query.toLowerCase();
    return orders.filter(
      (o) =>
        (o.customer_cpf ?? "").includes(q) ||
        o.customer_name.toLowerCase().includes(text) ||
        String(o.number).includes(text)
    );
  }, [orders, query]);

  const byStatus = useMemo(() => {
    const map: Record<string, Order[]> = {};
    for (const c of COLUMNS) map[c.status] = [];
    for (const o of filtered) (map[o.status] ??= []).push(o);
    return map;
  }, [filtered]);

  async function advance(id: string, next: Status) {
    await fetch(`/api/pdv/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    refresh();
  }

  async function cancel(id: string) {
    if (!confirm("Cancelar pedido?")) return;
    await fetch(`/api/pdv/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    refresh();
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-palantir-border bg-palantir-bg/80 px-6 py-3 backdrop-blur">
        <div>
          <h1 className="text-base font-semibold text-white">Pedidos</h1>
          <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
            Kanban realtime · busca por CPF/nome/#
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="CPF, nome ou #pedido"
            className="mono rounded-admin border border-palantir-border bg-palantir-surface px-3 h-9 w-72 text-sm text-white outline-none focus:border-palantir-blue"
          />
          {query && (
            <button onClick={() => setQuery("")} className="mono text-[10px] text-palantir-muted">
              limpar
            </button>
          )}
          <span className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
            {filtered.length}/{orders.length}
          </span>
        </div>
      </header>

      {error && (
        <div className="mx-6 my-3 border border-palantir-red/40 bg-palantir-red/10 px-3 py-2 text-sm text-palantir-red">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-palantir-muted text-sm">
          carregando pedidos...
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-palantir-muted">Nenhum pedido ainda.</p>
            <p className="mono mt-2 text-[10px] uppercase tracking-widest text-palantir-muted/60">
              aguardando primeiros pedidos
            </p>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-5 gap-px overflow-hidden bg-palantir-border">
          {COLUMNS.map((col) => (
            <section key={col.status} className="flex min-h-0 flex-col bg-palantir-bg">
              <div className={`flex items-center justify-between border-b-2 px-3 py-2 ${col.accent}`}>
                <span className="mono text-xs font-bold tracking-wider">{col.label}</span>
                <span className="mono rounded-admin bg-palantir-surface2 px-2 text-xs">
                  {byStatus[col.status]?.length ?? 0}
                </span>
              </div>
              <div className="term-scroll flex-1 space-y-2 overflow-y-auto p-2">
                {byStatus[col.status]?.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    next={col.next}
                    nextLabel={col.cta}
                    onAdvance={() => col.next && advance(o.id, col.next)}
                    onCancel={() => cancel(o.id)}
                    onDeliver={() => setDelivering(o)}
                    columnStatus={col.status}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {delivering && (
        <DeliverDialog
          order={delivering}
          onClose={() => setDelivering(null)}
          onSaved={() => {
            setDelivering(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────

function OrderCard({
  order,
  next,
  nextLabel,
  onAdvance,
  onCancel,
  onDeliver,
  columnStatus,
}: {
  order: Order;
  next?: Status;
  nextLabel?: string;
  onAdvance: () => void;
  onCancel: () => void;
  onDeliver: () => void;
  columnStatus: Status;
}) {
  const totalPedidos = order.items.reduce((s, i) => s + i.qty, 0);
  const totalEntregues = order.items.reduce((s, i) => s + i.delivered_qty, 0);
  const canDeliver = ["ready", "partial"].includes(columnStatus);

  return (
    <article className="animate-slide-in rounded-admin border border-palantir-border bg-palantir-surface p-3">
      <div className="flex items-center justify-between">
        <span className="mono font-bold text-white">#{order.number}</span>
        <span className="mono text-xs text-palantir-muted">{formatTime(order.created_at)}</span>
      </div>
      <div className="mt-1 text-sm text-palantir-text truncate">
        {order.customer_name}
      </div>
      {order.customer_cpf && (
        <div className="mono text-[10px] text-palantir-muted">
          CPF: {order.customer_cpf}
        </div>
      )}
      <ul className="my-2 space-y-0.5">
        {order.items.map((it) => {
          const fullyDelivered = it.delivered_qty >= it.qty;
          const partial = it.delivered_qty > 0 && !fullyDelivered;
          return (
            <li key={it.id} className="text-sm text-palantir-text">
              <span className={`mono ${
                fullyDelivered ? "text-palantir-muted" : partial ? "text-somma-orange" : "text-palantir-blue"
              }`}>
                {partial || fullyDelivered ? `${it.delivered_qty}/${it.qty}` : it.qty}×
              </span>{" "}
              <span className={fullyDelivered ? "line-through text-palantir-muted" : ""}>
                {it.name}
              </span>
              {it.notes && (
                <span className="block pl-4 text-xs text-palantir-yellow">↳ {it.notes}</span>
              )}
            </li>
          );
        })}
      </ul>
      {totalEntregues > 0 && totalEntregues < totalPedidos && (
        <div className="mono mb-2 rounded-admin bg-somma-orange/10 px-2 py-1 text-[10px] text-somma-orange">
          Entregue {totalEntregues}/{totalPedidos}
        </div>
      )}
      <div className="mono mb-2 text-xs text-palantir-muted">
        {order.method.toUpperCase()} · {brl(order.total)}
      </div>
      <div className="flex gap-1">
        {next && (
          <button
            onClick={onAdvance}
            className="flex-1 rounded-admin bg-palantir-blue py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            {nextLabel}
          </button>
        )}
        {canDeliver && (
          <button
            onClick={onDeliver}
            className="flex-1 rounded-admin bg-palantir-green py-1.5 text-xs font-semibold text-black hover:opacity-90"
          >
            ENTREGAR
          </button>
        )}
        {columnStatus === "paid" && (
          <button
            onClick={onCancel}
            className="rounded-admin border border-palantir-red px-2 text-xs text-palantir-red hover:bg-palantir-red/10"
          >
            ✕
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Deliver dialog ───────────────────────────────────────────────

function DeliverDialog({
  order,
  onClose,
  onSaved,
}: {
  order: Order;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Estado: quantidades sendo entregues agora (default = restante de cada item)
  const initial = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of order.items) m[it.id] = it.qty - it.delivered_qty;
    return m;
  }, [order]);
  const [qts, setQts] = useState<Record<string, number>>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(id: string, n: number) {
    const it = order.items.find((i) => i.id === id);
    if (!it) return;
    const max = it.qty - it.delivered_qty;
    setQts((q) => ({ ...q, [id]: Math.max(0, Math.min(max, n)) }));
  }

  function entregarTudo() {
    setQts(initial);
  }
  function limpar() {
    setQts(Object.fromEntries(Object.keys(initial).map((k) => [k, 0])));
  }

  async function save() {
    setError(null);
    const deliveries = Object.entries(qts)
      .filter(([, q]) => q > 0)
      .map(([item_id, qty]) => ({ item_id, qty }));
    if (deliveries.length === 0) {
      setError("Selecione ao menos 1 item");
      return;
    }
    setLoading(true);
    const r = await fetch(`/api/pdv/orders/${order.id}/deliver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveries }),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error ?? "Erro");
      return;
    }
    onSaved();
  }

  const totalAgora = Object.values(qts).reduce((s, n) => s + n, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-admin border border-palantir-border bg-palantir-surface p-5"
      >
        <p className="mono text-[10px] tracking-widest text-palantir-muted">REGISTRAR ENTREGA</p>
        <div className="flex items-center justify-between mt-1 mb-4">
          <h2 className="text-lg font-semibold text-white">
            #{order.number} · {order.customer_name}
          </h2>
          <span className="mono text-[10px] text-palantir-muted">{order.customer_cpf}</span>
        </div>

        <div className="space-y-2 max-h-80 overflow-auto term-scroll">
          {order.items.map((it) => {
            const restante = it.qty - it.delivered_qty;
            const fullyDelivered = restante === 0;
            return (
              <div
                key={it.id}
                className={`flex items-center gap-3 rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 ${
                  fullyDelivered ? "opacity-50" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-palantir-text truncate">{it.name}</p>
                  <p className="mono text-[10px] text-palantir-muted">
                    Pedidos: <span className="text-palantir-text">{it.qty}</span>{" "}
                    · Já entregues: <span className="text-somma-orange">{it.delivered_qty}</span>{" "}
                    · Restante: <span className="text-palantir-blue">{restante}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => update(it.id, (qts[it.id] ?? 0) - 1)}
                    disabled={fullyDelivered || (qts[it.id] ?? 0) <= 0}
                    className="size-8 rounded-admin border border-palantir-border text-palantir-text disabled:opacity-30"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={qts[it.id] ?? 0}
                    onChange={(e) => update(it.id, Number(e.target.value) || 0)}
                    disabled={fullyDelivered}
                    min={0}
                    max={restante}
                    className="mono w-14 rounded-admin border border-palantir-border bg-palantir-bg px-2 h-8 text-center text-white disabled:opacity-30"
                  />
                  <button
                    onClick={() => update(it.id, (qts[it.id] ?? 0) + 1)}
                    disabled={fullyDelivered || (qts[it.id] ?? 0) >= restante}
                    className="size-8 rounded-admin border border-palantir-border text-palantir-text disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={entregarTudo}
            className="mono rounded-admin border border-palantir-border px-3 py-1.5 text-[10px] uppercase text-palantir-text hover:bg-palantir-surface2"
          >
            Entregar tudo restante
          </button>
          <button
            onClick={limpar}
            className="mono rounded-admin border border-palantir-border px-3 py-1.5 text-[10px] uppercase text-palantir-text hover:bg-palantir-surface2"
          >
            Zerar
          </button>
          <span className="ml-auto mono text-xs text-palantir-muted self-center">
            Entregando agora: <span className="text-somma-orange">{totalAgora}</span>
          </span>
        </div>

        {error && <p className="mono mt-3 text-xs text-palantir-red">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="mono text-xs text-palantir-muted px-3 py-2">
            cancelar
          </button>
          <button
            onClick={save}
            disabled={loading || totalAgora === 0}
            className="rounded-admin bg-palantir-green px-4 py-2 text-sm text-black font-semibold disabled:opacity-40"
          >
            {loading ? "Salvando..." : "Confirmar entrega"}
          </button>
        </div>
      </div>
    </div>
  );
}
