"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Search, Plus, Minus } from "lucide-react";
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
  { status: "partial", label: "PARCIAL", accent: "text-somma-orange border-somma-orange" },
  { status: "delivered", label: "ENTREGUES", accent: "text-palantir-muted border-palantir-muted" },
];

export function Pedidos({ slug }: { slug: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [delivering, setDelivering] = useState<Order | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const beepRef = useRef<(() => void) | null>(null);
  const prevNewIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    beepRef.current = () => {
      try {
        const ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
    <div className="flex h-full min-h-[calc(100dvh-7rem)] md:min-h-dvh-100 flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-palantir-border bg-palantir-bg/85 px-3 sm:px-6 py-3 backdrop-blur">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-white">Pedidos</h1>
          <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted truncate">
            Kanban realtime · CPF/nome/#
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search desktop */}
          <div className="hidden md:flex items-center gap-2">
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
          {/* Search mobile — ícone que abre overlay */}
          <button
            onClick={() => setSearchOpen(true)}
            className="md:hidden grid size-touch place-items-center rounded-admin border border-palantir-border text-palantir-text focus-ring-admin"
            aria-label="Buscar pedidos"
          >
            <Search className="size-4" />
          </button>
          <span className="md:hidden mono text-[10px] uppercase tracking-wider text-palantir-muted">
            {filtered.length}/{orders.length}
          </span>
        </div>
      </header>

      {/* Search overlay mobile */}
      {searchOpen && (
        <div className="md:hidden border-b border-palantir-border bg-palantir-surface px-3 py-2 flex items-center gap-2 animate-fade-in">
          <Search className="size-4 text-palantir-muted shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="CPF, nome ou #pedido"
            className="mono flex-1 bg-transparent text-sm text-white outline-none min-h-touch"
          />
          <button
            onClick={() => {
              setQuery("");
              setSearchOpen(false);
            }}
            aria-label="Fechar busca"
            className="grid size-touch place-items-center text-palantir-muted focus-ring-admin"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="mx-3 sm:mx-6 my-3 border border-palantir-red/40 bg-palantir-red/10 px-3 py-2 text-sm text-palantir-red">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-palantir-muted text-sm">
          carregando pedidos...
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <p className="text-palantir-muted">Nenhum pedido ainda.</p>
            <p className="mono mt-2 text-[10px] uppercase tracking-widest text-palantir-muted/60">
              aguardando primeiros pedidos
            </p>
          </div>
        </div>
      ) : (
        /*
          Kanban:
          - <lg: scroll horizontal com snap, colunas com min-w fixo
          - lg+: grid 5 colunas
          Cada coluna tem header sticky.
        */
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden bg-palantir-border lg:overflow-hidden">
          <div className="flex h-full gap-px lg:grid lg:grid-cols-5 scroll-snap-x">
            {COLUMNS.map((col) => (
              <section
                key={col.status}
                className="flex h-full min-w-[78vw] sm:min-w-[60vw] lg:min-w-0 flex-col bg-palantir-bg snap-start"
              >
                <div
                  className={`sticky top-0 z-10 flex items-center justify-between border-b-2 bg-palantir-bg px-3 py-2 ${col.accent}`}
                >
                  <span className="mono text-xs font-bold tracking-wider">{col.label}</span>
                  <span className="mono rounded-admin bg-palantir-surface2 px-2 text-xs">
                    {byStatus[col.status]?.length ?? 0}
                  </span>
                </div>
                <div className="term-scroll flex-1 space-y-2 overflow-y-auto p-2 pb-6">
                  {byStatus[col.status]?.length === 0 && (
                    <p className="mono text-center text-[10px] text-palantir-muted/60 py-4 uppercase">
                      vazio
                    </p>
                  )}
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
      <div className="mt-1 text-sm text-palantir-text truncate">{order.customer_name}</div>
      {order.customer_cpf && (
        <div className="mono text-[10px] text-palantir-muted">CPF: {order.customer_cpf}</div>
      )}
      <ul className="my-2 space-y-0.5">
        {order.items.map((it) => {
          const fullyDelivered = it.delivered_qty >= it.qty;
          const partial = it.delivered_qty > 0 && !fullyDelivered;
          return (
            <li key={it.id} className="text-sm text-palantir-text">
              <span
                className={`mono ${
                  fullyDelivered
                    ? "text-palantir-muted"
                    : partial
                    ? "text-somma-orange"
                    : "text-palantir-blue"
                }`}
              >
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
            className="flex-1 rounded-admin bg-palantir-blue min-h-touch py-2 text-xs font-semibold text-white hover:opacity-90 focus-ring-admin"
          >
            {nextLabel}
          </button>
        )}
        {canDeliver && (
          <button
            onClick={onDeliver}
            className="flex-1 rounded-admin bg-palantir-green min-h-touch py-2 text-xs font-semibold text-black hover:opacity-90 focus-ring-admin"
          >
            ENTREGAR
          </button>
        )}
        {columnStatus === "paid" && (
          <button
            onClick={onCancel}
            aria-label="Cancelar pedido"
            className="grid min-h-touch min-w-touch place-items-center rounded-admin border border-palantir-red text-palantir-red hover:bg-palantir-red/10 focus-ring-admin"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Deliver dialog (bottom-sheet em mobile) ──────────────────────

function DeliverDialog({
  order,
  onClose,
  onSaved,
}: {
  order: Order;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of order.items) m[it.id] = it.qty - it.delivered_qty;
    return m;
  }, [order]);
  const [qts, setQts] = useState<Record<string, number>>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Registrar entrega"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[85dvh] overflow-y-auto rounded-t-xl sm:rounded-admin border border-palantir-border bg-palantir-surface p-4 sm:p-5 pb-safe"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mono text-[10px] tracking-widest text-palantir-muted">REGISTRAR ENTREGA</p>
            <h2 className="text-base sm:text-lg font-semibold text-white truncate">
              #{order.number} · {order.customer_name}
            </h2>
            {order.customer_cpf && (
              <p className="mono text-[10px] text-palantir-muted">CPF: {order.customer_cpf}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-touch -mr-2 -mt-1 place-items-center text-palantir-muted hover:text-white focus-ring-admin"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
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
                    Pedido <span className="text-palantir-text">{it.qty}</span> · Entr.{" "}
                    <span className="text-somma-orange">{it.delivered_qty}</span> · Rest.{" "}
                    <span className="text-palantir-blue">{restante}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => update(it.id, (qts[it.id] ?? 0) - 1)}
                    disabled={fullyDelivered || (qts[it.id] ?? 0) <= 0}
                    aria-label="Diminuir"
                    className="grid size-touch place-items-center rounded-admin border border-palantir-border text-palantir-text disabled:opacity-30 focus-ring-admin"
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={qts[it.id] ?? 0}
                    onChange={(e) => update(it.id, Number(e.target.value) || 0)}
                    disabled={fullyDelivered}
                    min={0}
                    max={restante}
                    aria-label={`Quantidade ${it.name}`}
                    className="mono w-14 rounded-admin border border-palantir-border bg-palantir-bg px-2 min-h-touch text-center text-white disabled:opacity-30 focus-ring-admin"
                  />
                  <button
                    onClick={() => update(it.id, (qts[it.id] ?? 0) + 1)}
                    disabled={fullyDelivered || (qts[it.id] ?? 0) >= restante}
                    aria-label="Aumentar"
                    className="grid size-touch place-items-center rounded-admin border border-palantir-border text-palantir-text disabled:opacity-30 focus-ring-admin"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={entregarTudo}
            className="mono rounded-admin border border-palantir-border min-h-touch px-3 text-[10px] uppercase text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
          >
            Tudo restante
          </button>
          <button
            onClick={limpar}
            className="mono rounded-admin border border-palantir-border min-h-touch px-3 text-[10px] uppercase text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
          >
            Zerar
          </button>
          <span className="ml-auto mono text-xs text-palantir-muted">
            Agora: <span className="text-somma-orange">{totalAgora}</span>
          </span>
        </div>

        {error && <p className="mono mt-3 text-xs text-palantir-red">{error}</p>}

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            onClick={onClose}
            className="mono text-xs text-palantir-muted min-h-touch px-3 focus-ring-admin"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={loading || totalAgora === 0}
            className="rounded-admin bg-palantir-green min-h-touch px-4 text-sm text-black font-semibold disabled:opacity-40 focus-ring-admin"
          >
            {loading ? "Salvando..." : "Confirmar entrega"}
          </button>
        </div>
      </div>
    </div>
  );
}
