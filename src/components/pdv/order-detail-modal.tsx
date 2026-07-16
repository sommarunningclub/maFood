"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Clock,
  CheckCircle2,
  CreditCard,
  MessageSquare,
  User,
  Pencil,
  Plus,
  Minus,
  Trash2,
  Save,
  AlertTriangle,
  Loader2,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { brl, cn, formatTime } from "@/lib/utils";

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
  method: "pix" | "card" | "counter";
  status: Status;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  ready_at: string | null;
  refund_status:
    | "requested"
    | "pending"
    | "partial"
    | "done"
    | "cancelled"
    | "failed"
    | null;
  refund_mode: "asaas" | "manual";
  refund_amount: number | null;
  refund_requested_at: string | null;
  refunded_at: string | null;
  refund_receipt_url: string | null;
  refund_eligible: boolean;
  items: OrderItem[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string | null;
  status: "active" | "paused" | "out_of_stock";
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

const REFUND_STATUS_LABEL: Record<
  NonNullable<Order["refund_status"]>,
  string
> = {
  requested: "Solicitação enviada",
  pending: "Aguardando confirmação do reembolso",
  partial: "Reembolso parcial",
  done: "Reembolso concluído",
  cancelled: "Reembolso cancelado",
  failed: "Falha na tentativa de reembolso",
};

const TERMINAL: Status[] = ["delivered", "cancelled"];

// Linhas editáveis usam um id local — pra items novos (sem .id do banco)
// usamos um prefixo "new-" pra distinguir.
type EditableLine = {
  key: string;
  id?: string; // do banco; ausente = novo
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  delivered_qty: number; // 0 pra novos
  item_notes: string | null;
};

export function OrderDetailModal({
  order: orderProp,
  onClose,
  onSaved,
  onConfirmPayment,
  onRefunded,
}: {
  order: Order;
  onClose: () => void;
  onSaved?: () => void;
  /** Confirma pagamento na maquininha (pending → paid). */
  onConfirmPayment?: () => void | Promise<void>;
  /** Atualiza o Kanban sem fechar o resultado do reembolso. */
  onRefunded?: () => void | Promise<void>;
}) {
  const [order, setOrder] = useState<Order>(orderProp);
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [notesDraft, setNotesDraft] = useState<string>(orderProp.notes ?? "");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingPay, setConfirmingPay] = useState(false);
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [refundResult, setRefundResult] = useState<{
    message: string;
    receiptUrl: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrder(orderProp);
    setNotesDraft(orderProp.notes ?? "");
  }, [orderProp]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || refunding) return;
      if (editing) cancelEdit();
      else if (refundConfirmOpen) setRefundConfirmOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, onClose, refundConfirmOpen, refunding]);

  function startEdit() {
    setError(null);
    setLines(
      order.items.map((it) => ({
        key: it.id,
        id: it.id,
        product_id: it.product_id ?? "",
        name: it.name,
        qty: it.qty,
        unit_price: it.unit_price,
        delivered_qty: it.delivered_qty,
        item_notes: it.notes,
      }))
    );
    setNotesDraft(order.notes ?? "");
    setEditing(true);
    if (products.length === 0) void loadProducts();
  }

  function cancelEdit() {
    setEditing(false);
    setAdding(false);
    setError(null);
  }

  async function loadProducts() {
    setProductsLoading(true);
    try {
      const r = await fetch("/api/pdv/products");
      const data = await r.json();
      if (r.ok) {
        setProducts(
          (data.products as Product[])
            .filter((p) => p.status === "active")
            .map((p) => ({ ...p, price: Number(p.price) }))
        );
      }
    } finally {
      setProductsLoading(false);
    }
  }

  function updateQty(key: string, delta: number) {
    setLines((curr) =>
      curr.map((l) =>
        l.key === key ? { ...l, qty: Math.max(l.delivered_qty || 1, l.qty + delta) } : l
      )
    );
  }

  function removeLine(key: string) {
    const l = lines.find((x) => x.key === key);
    if (l && l.delivered_qty > 0) {
      setError("Item com entrega parcial não pode ser removido");
      return;
    }
    setLines((curr) => curr.filter((x) => x.key !== key));
  }

  function addProduct(p: Product) {
    // Se já tem na lista, incrementa
    const existing = lines.find((l) => l.product_id === p.id);
    if (existing) {
      setLines((curr) =>
        curr.map((l) => (l.key === existing.key ? { ...l, qty: l.qty + 1 } : l))
      );
    } else {
      setLines((curr) => [
        ...curr,
        {
          key: `new-${p.id}-${Date.now()}`,
          product_id: p.id,
          name: p.name,
          qty: 1,
          unit_price: p.price,
          delivered_qty: 0,
          item_notes: null,
        },
      ]);
    }
    setAdding(false);
    setProductSearch("");
  }

  const editTotal = useMemo(
    () => lines.reduce((s, l) => s + l.qty * l.unit_price, 0),
    [lines]
  );

  async function save() {
    setError(null);
    if (lines.length === 0) {
      setError("Pedido precisa de pelo menos 1 item");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/pdv/orders/${order.id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notesDraft.trim() || null,
          items: lines.map((l) => ({
            id: l.id,
            product_id: l.product_id,
            qty: l.qty,
            item_notes: l.item_notes,
          })),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      setEditing(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  async function requestRefund() {
    setError(null);
    setRefunding(true);
    try {
      const response = await fetch(`/api/pdv/orders/${order.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: refundReason.trim() }),
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        refund_status?: Order["refund_status"];
        receipt_url?: string | null;
      };

      if (!response.ok) {
        setError(data.error ?? "Não foi possível realizar o reembolso");
        return;
      }

      const now = new Date().toISOString();
      setOrder((current) => ({
        ...current,
        status: "cancelled",
        refund_eligible: false,
        refund_status: data.refund_status ?? "pending",
        refund_amount: current.total,
        refund_requested_at: current.refund_requested_at ?? now,
        refunded_at:
          data.refund_status === "done" ? now : current.refunded_at,
        refund_receipt_url:
          data.receipt_url ?? current.refund_receipt_url,
      }));
      setRefundConfirmOpen(false);
      setRefundResult({
        message: data.message ?? "Reembolso solicitado com sucesso.",
        receiptUrl: data.receipt_url ?? null,
      });
      await onRefunded?.();
    } catch {
      setError("Falha de conexão ao solicitar o reembolso");
    } finally {
      setRefunding(false);
    }
  }

  // ─── View mode (read-only) ────────────────────────────────────
  const isTerminal = TERMINAL.includes(order.status);
  const isAfterPaid = ["preparing", "ready", "partial"].includes(order.status);
  const subtotal = order.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const totalPedidos = order.items.reduce((s, i) => s + i.qty, 0);
  const totalEntregues = order.items.reduce((s, i) => s + i.delivered_qty, 0);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes do pedido #${order.number}`}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-4 animate-fade-in"
      onClick={() =>
        editing || refundConfirmOpen || refunding ? null : onClose()
      }
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto rounded-t-xl sm:rounded-admin border border-palantir-border bg-palantir-surface pb-safe"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-palantir-border bg-palantir-surface px-4 sm:px-5 py-3">
          <div className="min-w-0">
            <p className="mono text-[10px] tracking-widest text-palantir-muted">
              {editing ? "EDITANDO PEDIDO" : "DETALHES DO PEDIDO"}
            </p>
            <h2 className="text-lg sm:text-xl font-semibold text-white mt-0.5">
              #{order.number}
            </h2>
            <p className={`mono text-[11px] uppercase tracking-wider mt-1 ${STATUS_COLOR[order.status]}`}>
              ● {STATUS_LABEL[order.status]}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {!editing && !isTerminal && !refundConfirmOpen && (
              <button
                onClick={startEdit}
                title="Editar pedido"
                className="inline-flex items-center gap-1.5 rounded-admin border border-palantir-border min-h-touch px-3 text-xs text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
              >
                <Pencil className="size-3.5" />
                Editar
              </button>
            )}
            <button
              onClick={() => {
                if (refunding) return;
                if (editing) cancelEdit();
                else if (refundConfirmOpen) setRefundConfirmOpen(false);
                else onClose();
              }}
              disabled={refunding}
              aria-label="Fechar"
              className="grid size-touch -mr-2 -mt-1 place-items-center text-palantir-muted hover:text-white disabled:opacity-40 focus-ring-admin"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Aviso quando edita pedido já pago */}
        {editing && isAfterPaid && (
          <div className="mx-4 sm:mx-5 mt-3 rounded-admin border border-palantir-yellow/40 bg-palantir-yellow/10 p-3 flex gap-2">
            <AlertTriangle className="size-4 text-palantir-yellow shrink-0 mt-0.5" />
            <p className="text-xs text-palantir-yellow">
              Pedido já foi pago. Ao alterar items, o valor cobrado pelo Asaas
              <strong> não muda automaticamente</strong>. Para devolver o valor
              integral, use a opção de reembolso nos detalhes do pedido.
            </p>
          </div>
        )}

        <div className="px-4 sm:px-5 py-4 space-y-5">
          {/* Cliente */}
          <section>
            <SectionTitle icon={User} label="Cliente" />
            <p className="text-white text-base mt-1">{order.customer_name}</p>
            {order.customer_cpf && (
              <p className="mono text-xs text-palantir-muted mt-0.5">CPF: {order.customer_cpf}</p>
            )}
          </section>

          {/* Timeline (só no view mode) */}
          {!editing && (
            <section>
              <SectionTitle icon={Clock} label="Linha do tempo" />
              <div className="mt-2 space-y-1 mono text-xs text-palantir-text">
                <TimelineRow label="Pedido criado" time={order.created_at} />
                {order.paid_at && <TimelineRow label="Pago" time={order.paid_at} />}
                {order.ready_at && <TimelineRow label="Pronto" time={order.ready_at} />}
                {order.refund_requested_at && (
                  <TimelineRow
                    label="Reembolso solicitado"
                    time={order.refund_requested_at}
                  />
                )}
                {order.refunded_at && (
                  <TimelineRow
                    label="Reembolso concluído"
                    time={order.refunded_at}
                  />
                )}
              </div>
            </section>
          )}

          {!editing && order.refund_status && (
            <section>
              <SectionTitle icon={RotateCcw} label="Reembolso" />
              <div
                className={cn(
                  "mt-2 rounded-admin border px-3 py-2 text-sm",
                  order.refund_status === "done"
                    ? "border-palantir-green/40 bg-palantir-green/10 text-palantir-green"
                    : order.refund_status === "failed"
                      ? "border-palantir-red/40 bg-palantir-red/10 text-palantir-red"
                      : "border-palantir-yellow/40 bg-palantir-yellow/10 text-palantir-yellow"
                )}
              >
                <p className="font-medium">
                  {REFUND_STATUS_LABEL[order.refund_status]}
                </p>
                <p className="mono mt-1 text-[10px] uppercase">
                  {order.refund_mode === "asaas"
                    ? "Processado pelo Asaas"
                    : "Registrado manualmente"}
                  {order.refund_amount != null
                    ? ` · ${brl(order.refund_amount)}`
                    : ""}
                </p>
                {order.refund_receipt_url && (
                  <a
                    href={order.refund_receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs underline"
                  >
                    Abrir comprovante
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </section>
          )}

          {/* Itens */}
          <section>
            <SectionTitle
              icon={CheckCircle2}
              label={
                editing
                  ? `Itens (${lines.length})`
                  : `Itens (${totalEntregues}/${totalPedidos} entregues)`
              }
            />

            {editing ? (
              <>
                <ul className="mt-2 space-y-1.5">
                  {lines.map((l) => (
                    <li
                      key={l.key}
                      className="flex items-start gap-2 border border-palantir-border rounded-admin p-2 bg-palantir-bg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white">{l.name}</p>
                        <p className="mono text-[10px] text-palantir-muted mt-0.5">
                          {brl(l.unit_price)} cada
                          {l.delivered_qty > 0 && (
                            <span className="text-somma-orange ml-2">
                              · {l.delivered_qty} entregue{l.delivered_qty > 1 ? "s" : ""}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => updateQty(l.key, -1)}
                          disabled={l.qty <= Math.max(1, l.delivered_qty)}
                          aria-label="Diminuir"
                          className="grid size-8 place-items-center rounded-admin border border-palantir-border text-palantir-text disabled:opacity-30 focus-ring-admin"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="mono w-7 text-center text-white text-sm">{l.qty}</span>
                        <button
                          onClick={() => updateQty(l.key, +1)}
                          aria-label="Aumentar"
                          className="grid size-8 place-items-center rounded-admin border border-palantir-border text-palantir-text focus-ring-admin"
                        >
                          <Plus className="size-3" />
                        </button>
                        <button
                          onClick={() => removeLine(l.key)}
                          disabled={l.delivered_qty > 0}
                          aria-label="Remover item"
                          className="grid size-8 place-items-center text-palantir-muted hover:text-palantir-red disabled:opacity-30 focus-ring-admin"
                          title={
                            l.delivered_qty > 0
                              ? "Item já entregue parcialmente"
                              : "Remover"
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Botão Adicionar */}
                {!adding ? (
                  <button
                    onClick={() => {
                      setAdding(true);
                      if (products.length === 0) void loadProducts();
                    }}
                    className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-admin border border-dashed border-palantir-border min-h-touch text-xs text-palantir-blue hover:bg-palantir-surface2 focus-ring-admin"
                  >
                    <Plus className="size-3.5" /> Adicionar item
                  </button>
                ) : (
                  <div className="mt-2 rounded-admin border border-palantir-blue/40 bg-palantir-bg p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="buscar produto..."
                        autoFocus
                        className="flex-1 mono rounded-admin border border-palantir-border bg-palantir-surface px-2 h-9 text-sm text-white outline-none focus:border-palantir-blue"
                      />
                      <button
                        onClick={() => {
                          setAdding(false);
                          setProductSearch("");
                        }}
                        aria-label="Cancelar"
                        className="grid size-8 place-items-center text-palantir-muted hover:text-white focus-ring-admin"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {productsLoading ? (
                        <p className="mono text-[11px] text-palantir-muted text-center py-3">
                          carregando produtos...
                        </p>
                      ) : filteredProducts.length === 0 ? (
                        <p className="mono text-[11px] text-palantir-muted text-center py-3">
                          nenhum produto encontrado
                        </p>
                      ) : (
                        filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => addProduct(p)}
                            className="w-full flex items-center justify-between gap-2 px-2 py-2 text-sm text-palantir-text hover:bg-palantir-surface2 rounded-admin text-left focus-ring-admin"
                          >
                            <span className="truncate">{p.name}</span>
                            <span className="mono text-xs text-palantir-blue shrink-0">
                              {brl(p.price)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
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
                            className={cn(
                              "mono mr-1",
                              partial
                                ? "text-somma-orange"
                                : fully
                                ? "text-palantir-muted"
                                : "text-palantir-blue"
                            )}
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
                        <p className="mono text-[10px] text-palantir-muted">
                          {brl(it.qty * it.unit_price)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Notas */}
          <section>
            <SectionTitle icon={MessageSquare} label="Observações" />
            {editing ? (
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={2}
                placeholder="Ex.: sem cebola, ponto da carne..."
                className="mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 text-sm text-white outline-none focus:border-palantir-blue"
              />
            ) : order.notes ? (
              <p className="text-sm text-palantir-text mt-1 whitespace-pre-wrap">{order.notes}</p>
            ) : (
              <p className="text-sm text-palantir-muted/60 italic mt-1">— sem observações —</p>
            )}
          </section>

          {/* Totais */}
          <section className="border-t border-palantir-border pt-3 space-y-1">
            {editing ? (
              <div className="flex justify-between text-base font-semibold text-white">
                <span>Novo total</span>
                <span className="num">{brl(editTotal)}</span>
              </div>
            ) : (
              <>
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
                  {order.method === "pix"
                    ? "Pix"
                    : order.method === "counter"
                      ? "Pagar na tenda"
                      : "Cartão de crédito"}
                </div>
              </>
            )}
          </section>

          {error && (
            <p
              role="alert"
              className="text-sm text-palantir-red border border-palantir-red/30 bg-palantir-red/10 px-3 py-2 rounded-admin"
            >
              {error}
            </p>
          )}

          {refundResult && (
            <div
              role="status"
              className="rounded-admin border border-palantir-green/40 bg-palantir-green/10 px-3 py-3 text-sm text-palantir-green"
            >
              <p className="font-medium">{refundResult.message}</p>
              {refundResult.receiptUrl && (
                <a
                  href={refundResult.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs underline"
                >
                  Abrir comprovante do Asaas
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer com botões de edit */}
        {!editing &&
          order.status === "pending" &&
          order.method === "counter" &&
          onConfirmPayment && (
            <div className="sticky bottom-0 z-10 bg-palantir-surface border-t border-palantir-border px-4 sm:px-5 py-3 pb-safe">
              <p className="mono text-[10px] text-palantir-muted mb-2 uppercase tracking-wider">
                Confirme após o pagamento na maquininha (Pix ou cartão)
              </p>
              <button
                type="button"
                disabled={confirmingPay}
                onClick={async () => {
                  setConfirmingPay(true);
                  try {
                    await onConfirmPayment();
                  } finally {
                    setConfirmingPay(false);
                  }
                }}
                className="w-full rounded-admin bg-palantir-blue min-h-touch py-3 text-sm font-semibold text-white disabled:opacity-50 focus-ring-admin"
              >
                {confirmingPay ? "Confirmando…" : "CONFIRMAR PAGAMENTO"}
              </button>
            </div>
          )}
        {!editing && order.refund_eligible && (
          <div className="sticky bottom-0 z-10 space-y-3 border-t border-palantir-border bg-palantir-surface px-4 py-3 pb-safe sm:px-5">
            {!refundConfirmOpen ? (
              <>
                <p className="text-xs text-palantir-muted">
                  {order.refund_mode === "asaas"
                    ? "O reembolso integral será enviado ao Asaas."
                    : "Pagamento feito fora do Asaas. Devolva o valor pela maquininha ou Pix antes de registrar."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setRefundConfirmOpen(true);
                  }}
                  className="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-admin border border-palantir-red px-4 py-3 text-sm font-semibold text-palantir-red hover:bg-palantir-red/10 focus-ring-admin"
                >
                  <RotateCcw className="size-4" />
                  REEMBOLSAR CLIENTE
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2 rounded-admin border border-palantir-red/40 bg-palantir-red/10 p-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-palantir-red" />
                  <div className="text-xs text-palantir-text">
                    <p className="font-semibold text-palantir-red">
                      Confirmar reembolso integral de {brl(order.total)}?
                    </p>
                    <p className="mt-1">
                      Esta ação é financeira e não pode ser desfeita pelo painel.
                    </p>
                    {order.method === "card" && (
                      <p className="mt-1 text-palantir-yellow">
                        No cartão, o crédito pode levar até 10 dias úteis para
                        aparecer na fatura do cliente.
                      </p>
                    )}
                    {totalEntregues > 0 && (
                      <p className="mt-1 text-palantir-yellow">
                        Atenção: este pedido possui itens já entregues.
                      </p>
                    )}
                    {order.refund_mode === "manual" && (
                      <p className="mt-1 font-medium text-palantir-yellow">
                        Confirme somente depois de devolver o dinheiro pela
                        maquininha ou Pix.
                      </p>
                    )}
                  </div>
                </div>

                <label className="block">
                  <span className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
                    Motivo (opcional)
                  </span>
                  <textarea
                    value={refundReason}
                    onChange={(event) => setRefundReason(event.target.value)}
                    maxLength={200}
                    rows={2}
                    disabled={refunding}
                    placeholder="Ex.: cliente desistiu do pedido"
                    className="mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 text-sm text-white outline-none focus:border-palantir-blue disabled:opacity-50"
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundConfirmOpen(false)}
                    disabled={refunding}
                    className="min-h-touch flex-1 rounded-admin border border-palantir-border px-3 text-xs text-palantir-text disabled:opacity-50 focus-ring-admin"
                  >
                    VOLTAR
                  </button>
                  <button
                    type="button"
                    onClick={requestRefund}
                    disabled={refunding}
                    className="inline-flex min-h-touch flex-[2] items-center justify-center gap-2 rounded-admin bg-palantir-red px-3 text-xs font-semibold text-white disabled:opacity-50 focus-ring-admin"
                  >
                    {refunding && <Loader2 className="size-4 animate-spin" />}
                    {refunding
                      ? "PROCESSANDO..."
                      : order.refund_mode === "asaas"
                        ? "CONFIRMAR NO ASAAS"
                        : "JÁ DEVOLVI E QUERO REGISTRAR"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {editing && (
          <div className="sticky bottom-0 z-10 bg-palantir-surface border-t border-palantir-border px-4 sm:px-5 py-3 flex justify-end gap-2 pb-safe">
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="mono text-xs text-palantir-muted min-h-touch px-3 focus-ring-admin"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving || lines.length === 0}
              className="inline-flex items-center gap-2 rounded-admin bg-palantir-green min-h-touch px-4 text-sm font-semibold text-black disabled:opacity-40 focus-ring-admin"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        )}
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
