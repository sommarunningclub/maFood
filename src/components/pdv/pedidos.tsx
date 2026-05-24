"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { X, Search, Plus, Minus, PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, cn, formatTime } from "@/lib/utils";
import { OrderDetailModal } from "@/components/pdv/order-detail-modal";

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

interface ColumnSpec {
  status: Status;
  label: string;
  accent: string;
  next?: Status; // próximo step lógico (usado pelo botão CTA)
  cta?: string;
  acceptsFrom: Status[]; // statuses que podem ser soltados nesta coluna
}

/*
  DnD totalmente livre — qualquer card (não-pending) pode ser solto em
  qualquer coluna, inclusive voltando estados ou pulando direto pra entregue.
  Drop em "delivered" continua abrindo DeliverDialog porque entrega precisa
  registrar quantidade por item; demais drops são PATCH direto do status.
*/
const ALL_DROPPABLE: Status[] = ["paid", "preparing", "ready", "partial", "delivered"];

const COLUMNS: ColumnSpec[] = [
  {
    status: "paid",
    label: "NOVOS",
    accent: "text-palantir-yellow border-palantir-yellow",
    next: "preparing",
    cta: "ACEITAR",
    acceptsFrom: ALL_DROPPABLE,
  },
  {
    status: "preparing",
    label: "EM PREPARO",
    accent: "text-palantir-blue border-palantir-blue",
    next: "ready",
    cta: "MARCAR PRONTO",
    acceptsFrom: ALL_DROPPABLE,
  },
  {
    status: "ready",
    label: "PRONTOS",
    accent: "text-palantir-green border-palantir-green",
    acceptsFrom: ALL_DROPPABLE,
  },
  {
    status: "partial",
    label: "PARCIAL",
    accent: "text-somma-orange border-somma-orange",
    acceptsFrom: ALL_DROPPABLE,
  },
  {
    status: "delivered",
    label: "ENTREGUES",
    accent: "text-palantir-muted border-palantir-muted",
    acceptsFrom: ALL_DROPPABLE, // dispara DeliverDialog
  },
];

const DRAGGABLE_STATUSES: Status[] = ["paid", "preparing", "ready", "partial", "delivered"];

export function Pedidos({ slug }: { slug: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [delivering, setDelivering] = useState<Order | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const beepRef = useRef<(() => void) | null>(null);
  const prevNewIds = useRef<Set<string>>(new Set());

  const sensors = useSensors(
    // distância em desktop evita ativar drag em micro-cliques
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // long-press em touch (iPad/mobile): segura ~180ms pra arrastar; tap puro abre modal
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

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
    // Atualização otimista — UI move o card antes do round-trip
    setOrders((curr) => curr.map((o) => (o.id === id ? { ...o, status: next } : o)));
    const r = await fetch(`/api/pdv/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!r.ok) refresh(); // rollback via re-fetch
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

  const activeOrder = activeId ? orders.find((o) => o.id === activeId) ?? null : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    setActiveId(null);
    if (!e.over) return;

    const order = orders.find((o) => o.id === id);
    if (!order) return;

    const targetStatus = String(e.over.id) as Status;
    if (order.status === targetStatus) return;

    const target = COLUMNS.find((c) => c.status === targetStatus);
    if (!target || !target.acceptsFrom.includes(order.status)) return;

    // Entrega passa pelo dialog (suporta retirada parcial)
    if (targetStatus === "delivered") {
      setDelivering(order);
      return;
    }

    advance(id, targetStatus);
  }

  return (
    <div className="flex h-full min-h-[calc(100dvh-7rem)] md:min-h-dvh-100 flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-palantir-border bg-palantir-bg/85 px-3 sm:px-6 py-3 backdrop-blur">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-white">Pedidos</h1>
          <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted truncate">
            Kanban realtime · arraste entre colunas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/loja/${slug}/pedidos/novo`}
            className="inline-flex items-center gap-1.5 rounded-admin bg-palantir-blue min-h-touch px-3 text-xs font-semibold text-white focus-ring-admin"
            aria-label="Criar novo pedido manual"
          >
            <PlusCircle className="size-4" />
            <span className="hidden sm:inline">NOVO PEDIDO</span>
          </Link>
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden bg-palantir-border lg:overflow-hidden">
            <div className="flex h-full gap-px lg:grid lg:grid-cols-5 scroll-snap-x">
              {COLUMNS.map((col) => (
                <Column
                  key={col.status}
                  col={col}
                  orders={byStatus[col.status] ?? []}
                  activeOrderStatus={activeOrder?.status}
                  onAdvance={(id, next) => advance(id, next)}
                  onCancel={cancel}
                  onDeliver={(o) => setDelivering(o)}
                  onOpen={(o) => setDetail(o)}
                />
              ))}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeOrder ? <OrderCard order={activeOrder} columnStatus={activeOrder.status} dragging /> : null}
          </DragOverlay>
        </DndContext>
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

      {detail && (
        <OrderDetailModal
          order={detail}
          onClose={() => setDetail(null)}
          onSaved={() => {
            setDetail(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Coluna (droppable) ────────────────────────────────────────────

function Column({
  col,
  orders,
  activeOrderStatus,
  onAdvance,
  onCancel,
  onDeliver,
  onOpen,
}: {
  col: ColumnSpec;
  orders: Order[];
  activeOrderStatus: Status | undefined;
  onAdvance: (id: string, next: Status) => void;
  onCancel: (id: string) => void;
  onDeliver: (o: Order) => void;
  onOpen: (o: Order) => void;
}) {
  const accepts =
    activeOrderStatus !== undefined && col.acceptsFrom.includes(activeOrderStatus);
  const { setNodeRef, isOver } = useDroppable({ id: col.status, disabled: !accepts });

  return (
    <section
      ref={setNodeRef}
      className={`flex h-full min-w-[78vw] sm:min-w-[60vw] lg:min-w-0 flex-col bg-palantir-bg snap-start transition-colors ${
        accepts ? "ring-1 ring-inset ring-palantir-blue/40" : ""
      } ${isOver && accepts ? "bg-palantir-blue/10" : ""}`}
    >
      <div
        className={`sticky top-0 z-10 flex items-center justify-between border-b-2 bg-palantir-bg px-3 py-2 ${col.accent}`}
      >
        <span className="mono text-xs font-bold tracking-wider">{col.label}</span>
        <span className="mono rounded-admin bg-palantir-surface2 px-2 text-xs">
          {orders.length}
        </span>
      </div>
      <div className="term-scroll flex-1 space-y-2 overflow-y-auto p-2 pb-6">
        {orders.length === 0 && (
          <p className="mono text-center text-[10px] text-palantir-muted/60 py-4 uppercase">
            {accepts ? "solte aqui" : "vazio"}
          </p>
        )}
        {orders.map((o) => (
          <DraggableCard
            key={o.id}
            order={o}
            next={col.next}
            nextLabel={col.cta}
            onAdvance={() => col.next && onAdvance(o.id, col.next)}
            onCancel={() => onCancel(o.id)}
            onDeliver={() => onDeliver(o)}
            onOpen={() => onOpen(o)}
            columnStatus={col.status}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Card draggable wrapper ────────────────────────────────────────

function DraggableCard({
  order,
  next,
  nextLabel,
  onAdvance,
  onCancel,
  onDeliver,
  onOpen,
  columnStatus,
}: {
  order: Order;
  next?: Status;
  nextLabel?: string;
  onAdvance: () => void;
  onCancel: () => void;
  onDeliver: () => void;
  onOpen: () => void;
  columnStatus: Status;
}) {
  const draggable = DRAGGABLE_STATUSES.includes(columnStatus);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
    disabled: !draggable,
  });

  /*
    Card inteiro vira drag handle (qualquer toque longo arrasta no iPad).
    Tap puro abre o modal de detalhes; dnd-kit não dispara click se
    activationConstraint for satisfeito (long-press OR move > tolerance).
    Botões internos param a propagação pra não abrir modal junto.
  */
  return (
    <div
      ref={setNodeRef}
      {...(draggable ? { ...attributes, ...listeners } : {})}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Abrir pedido #${order.number} de ${order.customer_name}`}
      className={cn(
        "cursor-pointer focus:outline-none rounded-admin focus-visible:ring-2 focus-visible:ring-palantir-blue/60",
        isDragging && "opacity-30",
        draggable && "active:cursor-grabbing"
      )}
      style={{ touchAction: draggable ? "none" : undefined }}
    >
      <OrderCard
        order={order}
        next={next}
        nextLabel={nextLabel}
        onAdvance={onAdvance}
        onCancel={onCancel}
        onDeliver={onDeliver}
        columnStatus={columnStatus}
      />
    </div>
  );
}

// ─── Card visual ──────────────────────────────────────────────────

function OrderCard({
  order,
  next,
  nextLabel,
  onAdvance,
  onCancel,
  onDeliver,
  columnStatus,
  dragging,
}: {
  order: Order;
  next?: Status;
  nextLabel?: string;
  onAdvance?: () => void;
  onCancel?: () => void;
  onDeliver?: () => void;
  columnStatus: Status;
  dragging?: boolean;
}) {
  const totalPedidos = order.items.reduce((s, i) => s + i.qty, 0);
  const totalEntregues = order.items.reduce((s, i) => s + i.delivered_qty, 0);
  const canDeliver = ["ready", "partial"].includes(columnStatus);

  // Stop click no botão pra não abrir o modal de detalhes junto
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <article
      className={`animate-slide-in rounded-admin border border-palantir-border bg-palantir-surface p-3 ${
        dragging ? "shadow-xl ring-2 ring-palantir-blue/60 rotate-1" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="mono font-bold text-white">#{order.number}</span>
          <div className="text-sm text-palantir-text truncate">{order.customer_name}</div>
          {order.customer_cpf && (
            <div className="mono text-[10px] text-palantir-muted">CPF: {order.customer_cpf}</div>
          )}
        </div>
        <span className="mono text-xs text-palantir-muted shrink-0">
          {formatTime(order.created_at)}
        </span>
      </div>
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
      {(onAdvance || onDeliver || onCancel) && !dragging && (
        <div className="flex gap-1">
          {next && onAdvance && (
            <button
              onClick={(e) => { stop(e); onAdvance(); }}
              className="flex-1 rounded-admin bg-palantir-blue min-h-touch py-2 text-xs font-semibold text-white hover:opacity-90 focus-ring-admin"
            >
              {nextLabel}
            </button>
          )}
          {canDeliver && onDeliver && (
            <button
              onClick={(e) => { stop(e); onDeliver(); }}
              className="flex-1 rounded-admin bg-palantir-green min-h-touch py-2 text-xs font-semibold text-black hover:opacity-90 focus-ring-admin"
            >
              ENTREGAR
            </button>
          )}
          {columnStatus === "paid" && onCancel && (
            <button
              onClick={(e) => { stop(e); onCancel(); }}
              aria-label="Cancelar pedido"
              className="grid min-h-touch min-w-touch place-items-center rounded-admin border border-palantir-red text-palantir-red hover:bg-palantir-red/10 focus-ring-admin"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      )}
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
