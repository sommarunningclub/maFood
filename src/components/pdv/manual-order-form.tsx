"use client";

/*
  Formulário POS-like: operador do PDV cria um pedido no nome de um cliente.
  - Etapa 1: input CPF, busca via /api/customer/lookup (existente/vip/new)
  - Etapa 2: se "new", coleta nome+contato; cria customer junto com order
  - Etapa 3: seleção de produtos do PDV, qty, observações, total
  - Etapa 4: gera Pix (Asaas) e exibe QR + link da fatura + cópia-cola

  Após pago, o pedido transita pra "paid" via webhook e cai na fila Kanban.
*/
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, Search, Plus, Minus, Copy, ExternalLink, Trash2, Mail, MessageCircle, Link2, Check } from "lucide-react";
import { brl } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  status: "active" | "paused" | "out_of_stock";
}

interface CustomerLite {
  cpf: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  isExisting: boolean; // true = já tem registro maFood; false = precisa criar
}

interface Result {
  order_id: string;
  order_number: number;
  total: number;
  method: "pix" | "card";
  pix_payload: string | null;
  pix_qr_code: string | null;
  invoice_url: string | null;
  pay_url: string | null;
  simulated: boolean;
  customer: { id: string; name: string; cpf: string; email: string | null; phone: string | null };
}

export function ManualOrderForm({ slug }: { slug: string }) {
  const [cpfRaw, setCpfRaw] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [qts, setQts] = useState<Record<string, number>>({});
  const [productSearch, setProductSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // Carrega produtos uma vez
  useEffect(() => {
    fetch("/api/pdv/products")
      .then((r) => r.json())
      .then((d) => setProducts((d.products ?? []).filter((p: Product) => p.status === "active")))
      .catch(() => setError("Falha ao carregar produtos"));
  }, []);

  const cpf = cpfRaw.replace(/\D/g, "");
  const cpfValid = cpf.length === 11;

  async function lookup() {
    setError(null);
    if (!cpfValid) return setError("CPF deve ter 11 dígitos");
    setLookupLoading(true);
    try {
      const r = await fetch("/api/customer/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro");

      if (data.status === "existing") {
        // Não temos os dados completos no lookup quando 'existing' — só sinaliza
        // que existe. Usa CPF como referência; o backend vai resolver pelo CPF.
        setCustomer({
          cpf,
          name: data.prefill?.name ?? "Cliente cadastrado",
          email: data.prefill?.email,
          phone: data.prefill?.phone,
          isExisting: true,
        });
      } else if (data.status === "vip_match" || data.status === "new") {
        const prefill = data.prefill ?? {};
        setCustomer({
          cpf,
          name: prefill.name ?? "",
          email: prefill.email,
          phone: prefill.phone,
          isExisting: false,
        });
        setNewName(prefill.name ?? "");
        setNewEmail(prefill.email ?? "");
        setNewPhone(prefill.phone ? maskPhone(prefill.phone) : "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLookupLoading(false);
    }
  }

  function inc(id: string) {
    setQts((q) => ({ ...q, [id]: (q[id] ?? 0) + 1 }));
  }
  function dec(id: string) {
    setQts((q) => {
      const next = Math.max(0, (q[id] ?? 0) - 1);
      const copy = { ...q };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }
  function removeItem(id: string) {
    setQts((q) => {
      const copy = { ...q };
      delete copy[id];
      return copy;
    });
  }

  const cartLines = useMemo(
    () =>
      Object.entries(qts)
        .map(([id, qty]) => {
          const p = products.find((x) => x.id === id);
          return p ? { product: p, qty } : null;
        })
        .filter((x): x is { product: Product; qty: number } => !!x),
    [qts, products]
  );

  const total = cartLines.reduce((s, l) => s + l.qty * l.product.price, 0);

  const productsByCat = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const filtered = q
      ? products.filter((p) => p.name.toLowerCase().includes(q))
      : products;
    const m = new Map<string, Product[]>();
    for (const p of filtered) {
      const cat = p.category ?? "Sem categoria";
      const arr = m.get(cat) ?? [];
      arr.push(p);
      m.set(cat, arr);
    }
    return Array.from(m.entries());
  }, [products, productSearch]);

  async function submit() {
    setError(null);
    if (!customer) return setError("Identifique um cliente primeiro");
    if (cartLines.length === 0) return setError("Adicione ao menos 1 item");

    setSubmitting(true);
    try {
      const r = await fetch("/api/pdv/orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf,
          customer: customer.isExisting
            ? undefined
            : {
                name: newName.trim(),
                email: newEmail.trim() || null,
                phone: newPhone.replace(/\D/g, "") || null,
              },
          notes: notes.trim() || null,
          method,
          items: cartLines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro ao criar pedido");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setCpfRaw("");
    setCustomer(null);
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setQts({});
    setNotes("");
    setError(null);
    setResult(null);
  }

  // ─── Tela de sucesso (QR Pix) ─────────────────────────────────
  if (result) {
    return <ResultView slug={slug} result={result} onNew={reset} />;
  }

  // ─── Fluxo principal ──────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-palantir-border bg-palantir-bg/85 px-3 sm:px-6 py-3 backdrop-blur">
        <Link
          href={`/loja/${slug}/pedidos`}
          aria-label="Voltar ao Kanban"
          className="grid size-touch -ml-2 place-items-center text-palantir-muted hover:text-white focus-ring-admin"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-white">Novo pedido</h1>
          <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted truncate">
            POS · cobrança Pix (Asaas) · cliente paga pelo celular
          </p>
        </div>
      </header>

      <div className="flex-1 p-3 sm:p-6 space-y-4 max-w-2xl w-full mx-auto">
        {/* ── Cliente ─────────────────────────────────────────── */}
        <section className="border border-palantir-border bg-palantir-surface p-3 sm:p-4">
          <p className="mono text-[10px] tracking-widest text-palantir-muted mb-2">CLIENTE</p>
          {!customer ? (
            <div className="flex gap-2">
              <input
                value={maskCpf(cpfRaw)}
                onChange={(e) => setCpfRaw(e.target.value)}
                inputMode="numeric"
                placeholder="000.000.000-00"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && cpfValid && lookup()}
                className="mono flex-1 rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-lg tracking-wider text-white focus-ring-admin outline-none"
              />
              <button
                onClick={lookup}
                disabled={!cpfValid || lookupLoading}
                className="rounded-admin bg-palantir-blue min-h-touch px-4 text-sm text-white disabled:opacity-40 focus-ring-admin inline-flex items-center gap-1.5"
              >
                <Search className="size-4" />
                {lookupLoading ? "..." : "Buscar"}
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-white font-medium">
                    {customer.isExisting ? customer.name : newName || "—"}
                  </p>
                  <p className="mono text-[11px] text-palantir-muted">
                    CPF {maskCpf(customer.cpf)}{" "}
                    {customer.isExisting ? (
                      <span className="text-palantir-green ml-2">● cadastrado</span>
                    ) : (
                      <span className="text-palantir-yellow ml-2">● novo</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCustomer(null);
                    setCpfRaw("");
                  }}
                  className="mono text-[10px] text-palantir-muted hover:text-white min-h-touch px-2 focus-ring-admin"
                >
                  trocar
                </button>
              </div>

              {!customer.isExisting && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="block sm:col-span-2">
                    <span className="mono text-[10px] text-palantir-muted">Nome *</span>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      className="mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
                    />
                  </label>
                  <label className="block">
                    <span className="mono text-[10px] text-palantir-muted">E-mail</span>
                    <input
                      type="email"
                      inputMode="email"
                      autoCapitalize="none"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
                    />
                  </label>
                  <label className="block">
                    <span className="mono text-[10px] text-palantir-muted">Telefone</span>
                    <input
                      value={newPhone}
                      onChange={(e) => setNewPhone(maskPhone(e.target.value))}
                      inputMode="numeric"
                      placeholder="(00) 00000-0000"
                      className="mono mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Produtos ────────────────────────────────────────── */}
        {customer && (
          <section className="border border-palantir-border bg-palantir-surface">
            <div className="border-b border-palantir-border p-3 flex items-center justify-between gap-3">
              <p className="mono text-[10px] tracking-widest text-palantir-muted">PRODUTOS</p>
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="buscar..."
                className="w-32 sm:w-48 rounded-admin border border-palantir-border bg-palantir-bg px-2 h-9 text-sm text-white focus-ring-admin"
              />
            </div>
            <div className="max-h-80 sm:max-h-96 overflow-y-auto term-scroll">
              {productsByCat.length === 0 && (
                <p className="mono text-[10px] text-palantir-muted/60 text-center py-6 uppercase">
                  Nenhum produto encontrado
                </p>
              )}
              {productsByCat.map(([cat, list]) => (
                <div key={cat}>
                  <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted px-3 py-1.5 bg-palantir-surface2/40">
                    {cat}
                  </p>
                  {list.map((p) => {
                    const q = qts[p.id] ?? 0;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2 border-t border-palantir-border first:border-t-0"
                      >
                        <div className="size-10 shrink-0 rounded-admin bg-palantir-surface2 border border-palantir-border overflow-hidden grid place-items-center">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image_url} alt={p.name} className="size-full object-cover" />
                          ) : (
                            <span className="text-palantir-muted text-xs">—</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-palantir-text truncate">{p.name}</p>
                          <p className="mono text-[11px] text-palantir-muted">{brl(p.price)}</p>
                        </div>
                        {q === 0 ? (
                          <button
                            onClick={() => inc(p.id)}
                            aria-label={`Adicionar ${p.name}`}
                            className="grid size-touch place-items-center rounded-admin bg-palantir-blue text-white focus-ring-admin"
                          >
                            <Plus className="size-4" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => dec(p.id)}
                              aria-label="Diminuir"
                              className="grid size-touch place-items-center rounded-admin border border-palantir-border text-palantir-text focus-ring-admin"
                            >
                              <Minus className="size-4" />
                            </button>
                            <span className="mono w-7 text-center text-white">{q}</span>
                            <button
                              onClick={() => inc(p.id)}
                              aria-label="Aumentar"
                              className="grid size-touch place-items-center rounded-admin bg-palantir-blue text-white focus-ring-admin"
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Método de pagamento ─────────────────────────────── */}
        {customer && cartLines.length > 0 && (
          <section className="border border-palantir-border bg-palantir-surface p-3 sm:p-4">
            <p className="mono text-[10px] tracking-widest text-palantir-muted mb-2">PAGAMENTO</p>
            <div className="grid grid-cols-2 gap-2">
              {(["pix", "card"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`mono text-xs uppercase tracking-wider min-h-touch rounded-admin border focus-ring-admin ${
                    method === m
                      ? "border-palantir-blue bg-palantir-blue/10 text-palantir-blue"
                      : "border-palantir-border text-palantir-muted"
                  }`}
                >
                  {m === "pix" ? "Pix (QR)" : "Cartão (link)"}
                </button>
              ))}
            </div>
            {method === "card" && (
              <p className="mono text-[10px] text-palantir-muted mt-2">
                Cliente recebe link pra pagar com cartão. Envie por email ou WhatsApp na próxima tela.
              </p>
            )}
          </section>
        )}

        {/* ── Resumo + observações ─────────────────────────────── */}
        {customer && cartLines.length > 0 && (
          <section className="border border-palantir-border bg-palantir-surface p-3 sm:p-4">
            <p className="mono text-[10px] tracking-widest text-palantir-muted mb-2">RESUMO</p>
            <ul className="space-y-1.5 mb-3">
              {cartLines.map((l) => (
                <li key={l.product.id} className="flex justify-between text-sm">
                  <span className="text-palantir-text truncate">
                    <span className="mono text-palantir-blue">{l.qty}×</span> {l.product.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="mono text-palantir-text">{brl(l.qty * l.product.price)}</span>
                    <button
                      onClick={() => removeItem(l.product.id)}
                      aria-label="Remover"
                      className="grid size-7 place-items-center text-palantir-red hover:bg-palantir-red/10 focus-ring-admin"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <label className="block">
              <span className="mono text-[10px] text-palantir-muted">Observações (opcional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ex.: sem cebola, ponto da carne…"
                className="mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 text-sm text-white focus-ring-admin"
              />
            </label>
          </section>
        )}

        {error && (
          <p
            role="alert"
            className="mono text-sm text-palantir-red border border-palantir-red/30 bg-palantir-red/10 px-3 py-2 rounded-admin"
          >
            {error}
          </p>
        )}
      </div>

      {/* ── CTA sticky bottom ───────────────────────────────────── */}
      {customer && cartLines.length > 0 && (
        <div className="sticky bottom-[3.75rem] md:bottom-0 inset-x-0 z-20 bg-palantir-bg/95 backdrop-blur border-t border-palantir-border pb-safe">
          <div className="mx-auto max-w-2xl p-3 flex items-center gap-3">
            <div className="min-w-0">
              <p className="mono text-[10px] uppercase text-palantir-muted">Total</p>
              <p className="mono text-xl font-bold text-white">{brl(total)}</p>
            </div>
            <button
              onClick={submit}
              disabled={submitting || (!customer.isExisting && !newName.trim())}
              className="ml-auto rounded-admin bg-palantir-green min-h-touch px-5 text-sm text-black font-semibold disabled:opacity-40 focus-ring-admin"
            >
              {submitting
                ? method === "pix" ? "Gerando Pix..." : "Gerando link..."
                : method === "pix" ? "Gerar Pix" : "Gerar link de cartão"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tela de sucesso com QR Pix ──────────────────────────────────

function ResultView({
  slug,
  result,
  onNew,
}: {
  slug: string;
  result: Result;
  onNew: () => void;
}) {
  const router = useRouter();
  const [qrImg, setQrImg] = useState<string | null>(result.pix_qr_code || null);
  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (qrImg) return;
    if (result.method === "pix" && result.pix_payload) {
      QRCode.toDataURL(result.pix_payload, { width: 280, margin: 1 }).then((url) =>
        setQrImg(url)
      );
    }
  }, [qrImg, result.pix_payload, result.method]);

  // Detecção automática de pagamento: assina o Realtime do pedido (mesmo canal
  // do tracker do cliente). Quando o webhook do Asaas marca o pedido como pago,
  // a tela reflete "Pago!" e volta ao Kanban — o operador não fica preso no QR.
  useEffect(() => {
    if (result.method !== "pix") return;
    const supabase = createClient();
    let redirect: ReturnType<typeof setTimeout>;
    const markPaid = () => {
      setPaid(true);
      redirect = setTimeout(() => router.push(`/loja/${slug}/pedidos`), 2500);
    };
    // Fallback: se o status já mudou entre criar o pedido e assinar o canal,
    // uma leitura inicial garante que não perdemos o evento.
    supabase
      .from("orders")
      .select("status")
      .eq("id", result.order_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.status !== "pending") markPaid();
      });
    const ch = supabase
      .channel(`pdv-new-order-${result.order_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "mafood", table: "orders", filter: `id=eq.${result.order_id}` },
        (p) => {
          const status = (p.new as { status?: string } | null)?.status;
          if (status && status !== "pending" && status !== "cancelled") markPaid();
        }
      )
      .subscribe();
    return () => {
      clearTimeout(redirect);
      supabase.removeChannel(ch);
    };
  }, [result.method, result.order_id, router, slug]);

  async function copy(text: string | null) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  if (result.method === "card") {
    return <CardLinkResult slug={slug} result={result} onNew={onNew} />;
  }

  return (
    <div className="min-h-full p-4 sm:p-6 max-w-xl mx-auto">
      <header className="flex items-center gap-3 mb-6">
        <Link
          href={`/loja/${slug}/pedidos`}
          aria-label="Voltar ao Kanban"
          className="grid size-touch -ml-2 place-items-center text-palantir-muted hover:text-white focus-ring-admin"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-white">Pedido criado</h1>
          <p className="mono text-[11px] text-palantir-muted">
            #{result.order_number} · {paid ? "pago — indo para o Kanban" : "aguardando pagamento"}
          </p>
        </div>
      </header>

      <div className="border border-palantir-border bg-palantir-surface p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white font-medium">{result.customer.name}</p>
            <p className="mono text-[11px] text-palantir-muted">CPF {result.customer.cpf}</p>
          </div>
          <p className="mono text-2xl font-bold text-palantir-green">{brl(result.total)}</p>
        </div>

        {result.simulated && (
          <div className="mb-3 rounded-admin border border-palantir-yellow/40 bg-palantir-yellow/10 px-3 py-2 mono text-[11px] text-palantir-yellow">
            ⚠ Modo simulado — ASAAS_API_KEY não configurada em produção. QR gerado
            localmente, não é cobrável.
          </div>
        )}

        {paid && (
          <div className="my-6 flex flex-col items-center text-center gap-2">
            <div className="size-16 rounded-full bg-palantir-green/15 border-2 border-palantir-green grid place-items-center text-3xl text-palantir-green">
              <Check className="size-8" />
            </div>
            <p className="text-white font-semibold text-lg">Pagamento confirmado!</p>
            <p className="mono text-[11px] text-palantir-muted">
              Pedido entrou na fila &ldquo;NOVOS&rdquo;. Redirecionando ao Kanban…
            </p>
            <Link
              href={`/loja/${slug}/pedidos`}
              className="mono mt-1 text-xs text-palantir-blue hover:underline"
            >
              Ir agora
            </Link>
          </div>
        )}

        <div className={`flex justify-center my-4 ${paid ? "hidden" : ""}`}>
          {qrImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrImg.startsWith("data:") ? qrImg : `data:image/png;base64,${qrImg}`}
              alt="QR Code Pix"
              className="size-64 max-w-full"
            />
          ) : (
            <div className="size-64 grid place-items-center text-palantir-muted text-sm">
              gerando QR...
            </div>
          )}
        </div>

        {result.pix_payload && !paid && (
          <div>
            <p className="mono text-[10px] uppercase text-palantir-muted mb-1">
              Cópia-cola Pix
            </p>
            <div className="flex gap-2">
              <code className="mono flex-1 truncate rounded-admin border border-palantir-border bg-palantir-bg px-2 py-2 text-[11px] text-palantir-text">
                {result.pix_payload}
              </code>
              <button
                onClick={() => copy(result.pix_payload)}
                aria-label="Copiar Pix"
                className="grid size-touch place-items-center rounded-admin border border-palantir-border text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
              >
                <Copy className="size-4" />
              </button>
            </div>
            {copied && (
              <p className="mono text-[10px] text-palantir-green mt-1">copiado!</p>
            )}
          </div>
        )}

        {result.invoice_url && (
          <a
            href={result.invoice_url}
            target="_blank"
            rel="noreferrer"
            className="mono mt-3 inline-flex items-center gap-1 text-[11px] text-palantir-blue hover:underline"
          >
            Abrir fatura no Asaas <ExternalLink className="size-3" />
          </a>
        )}

        {!paid && (
          <p className="text-sm text-palantir-muted mt-4">
            Mostre o QR ao cliente. Assim que ele pagar, o pedido entra automaticamente
            na fila &ldquo;NOVOS&rdquo; do Kanban.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Link
          href={`/loja/${slug}/pedidos`}
          className="mono text-xs text-palantir-muted text-center min-h-touch px-3 inline-flex items-center justify-center focus-ring-admin"
        >
          Voltar ao Kanban
        </Link>
        <button
          onClick={onNew}
          className="rounded-admin bg-palantir-blue min-h-touch px-4 text-sm text-white focus-ring-admin"
        >
          + Novo pedido
        </button>
      </div>
    </div>
  );
}

// ─── Resultado quando method=card: envio do link ─────────────────

function CardLinkResult({
  slug,
  result,
  onNew,
}: {
  slug: string;
  result: Result;
  onNew: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [waMode, setWaMode] = useState(false);
  const [email, setEmail] = useState(result.customer.email ?? "");
  const [phone, setPhone] = useState(result.customer.phone ?? "");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const payUrl = result.pay_url ?? "";

  async function copyLink() {
    if (!payUrl) return;
    try {
      await navigator.clipboard.writeText(payUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function sendEmail() {
    setSending(true);
    setSendStatus(null);
    const r = await fetch(`/api/pdv/orders/${result.order_id}/send-payment-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "email", email }),
    });
    const data = await r.json();
    setSending(false);
    setSendStatus(
      r.ok
        ? { ok: true, msg: `E-mail enviado pra ${email}` }
        : { ok: false, msg: data.error ?? "Falha ao enviar" }
    );
  }

  function openWhatsApp() {
    const onlyDigits = phone.replace(/\D/g, "");
    if (onlyDigits.length < 10) {
      setSendStatus({ ok: false, msg: "Telefone inválido" });
      return;
    }
    // wa.me precisa do DDI; assume 55 (BR) se vier só DDD+número
    const intl = onlyDigits.startsWith("55") ? onlyDigits : `55${onlyDigits}`;
    const text = encodeURIComponent(
      `Olá ${result.customer.name}! Aqui está o link pra pagar seu pedido #${result.order_number} (${brl(result.total)}):\n\n${payUrl}\n\n— maFood`
    );
    window.open(`https://wa.me/${intl}?text=${text}`, "_blank", "noopener,noreferrer");
    setSendStatus({ ok: true, msg: "WhatsApp aberto em nova aba" });
  }

  return (
    <div className="min-h-full p-4 sm:p-6 max-w-xl mx-auto">
      <header className="flex items-center gap-3 mb-6">
        <Link
          href={`/loja/${slug}/pedidos`}
          aria-label="Voltar ao Kanban"
          className="grid size-touch -ml-2 place-items-center text-palantir-muted hover:text-white focus-ring-admin"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-white">Pedido criado</h1>
          <p className="mono text-[11px] text-palantir-muted">
            #{result.order_number} · link de cartão · aguardando pagamento
          </p>
        </div>
      </header>

      <div className="border border-palantir-border bg-palantir-surface p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white font-medium">{result.customer.name}</p>
            <p className="mono text-[11px] text-palantir-muted">CPF {result.customer.cpf}</p>
          </div>
          <p className="mono text-2xl font-bold text-palantir-green">{brl(result.total)}</p>
        </div>

        {result.simulated && (
          <div className="mb-3 rounded-admin border border-palantir-yellow/40 bg-palantir-yellow/10 px-3 py-2 mono text-[11px] text-palantir-yellow">
            ⚠ Modo simulado — ASAAS_API_KEY não configurada. Link funcional mas não cobra.
          </div>
        )}

        <div>
          <p className="mono text-[10px] uppercase text-palantir-muted mb-1">Link de pagamento</p>
          <div className="flex gap-2">
            <code className="mono flex-1 truncate rounded-admin border border-palantir-border bg-palantir-bg px-2 py-2 text-[11px] text-palantir-blue">
              {payUrl}
            </code>
            <button
              onClick={copyLink}
              aria-label="Copiar link"
              title="Copiar link"
              className="grid size-touch place-items-center rounded-admin border border-palantir-border text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
            >
              {copied ? <Check className="size-4 text-palantir-green" /> : <Link2 className="size-4" />}
            </button>
          </div>
          {copied && <p className="mono text-[10px] text-palantir-green mt-1">copiado!</p>}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => { setEmailMode(true); setWaMode(false); setSendStatus(null); }}
            className="inline-flex items-center justify-center gap-2 rounded-admin border border-palantir-border min-h-touch px-3 text-xs text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
          >
            <Mail className="size-4" /> E-mail
          </button>
          <button
            onClick={() => { setWaMode(true); setEmailMode(false); setSendStatus(null); }}
            className="inline-flex items-center justify-center gap-2 rounded-admin border border-palantir-border min-h-touch px-3 text-xs text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </button>
        </div>

        {emailMode && (
          <div className="mt-3 space-y-2">
            <label className="block">
              <span className="mono text-[10px] text-palantir-muted">E-mail do cliente</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
              />
            </label>
            <button
              onClick={sendEmail}
              disabled={!email.includes("@") || sending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-admin bg-palantir-blue min-h-touch text-sm text-white font-semibold disabled:opacity-40 focus-ring-admin"
            >
              {sending ? "Enviando..." : "Confirmar e enviar e-mail"}
            </button>
          </div>
        )}

        {waMode && (
          <div className="mt-3 space-y-2">
            <label className="block">
              <span className="mono text-[10px] text-palantir-muted">
                Telefone (cadastrado: {phone ? maskPhone(phone) : "—"})
              </span>
              <input
                value={maskPhone(phone)}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                className="mono mt-1 w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
              />
            </label>
            <button
              onClick={openWhatsApp}
              className="w-full inline-flex items-center justify-center gap-2 rounded-admin bg-palantir-green min-h-touch text-sm text-black font-semibold focus-ring-admin"
            >
              <MessageCircle className="size-4" /> Abrir WhatsApp com link
            </button>
          </div>
        )}

        {sendStatus && (
          <p
            className={`mt-3 mono text-[11px] ${
              sendStatus.ok ? "text-palantir-green" : "text-palantir-red"
            }`}
          >
            {sendStatus.ok ? "✓" : "✕"} {sendStatus.msg}
          </p>
        )}

        <p className="text-sm text-palantir-muted mt-5">
          Quando o cliente pagar, o pedido entra automaticamente na fila NOVOS do Kanban.
        </p>
      </div>

      <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Link
          href={`/loja/${slug}/pedidos`}
          className="mono text-xs text-palantir-muted text-center min-h-touch px-3 inline-flex items-center justify-center focus-ring-admin"
        >
          Voltar ao Kanban
        </Link>
        <button
          onClick={onNew}
          className="rounded-admin bg-palantir-blue min-h-touch px-4 text-sm text-white focus-ring-admin"
        >
          + Novo pedido
        </button>
      </div>
    </div>
  );
}
