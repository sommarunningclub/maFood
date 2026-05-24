"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, X, Upload, Loader2, Minus } from "lucide-react";
import { brl, cn } from "@/lib/utils";

type Status = "active" | "paused" | "out_of_stock";

interface Combo {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  status: Status;
}

interface ComboItem {
  combo_id: string;
  product_id: string;
  qty: number;
  name: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

export function CombosView({ slug }: { slug: string }) {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [items, setItems] = useState<ComboItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Combo | "new" | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [cr, pr] = await Promise.all([
        fetch("/api/pdv/combos"),
        fetch("/api/pdv/products"),
      ]);
      if (!cr.ok || !pr.ok) throw new Error("Falha ao carregar");
      const cdata = await cr.json();
      const pdata = await pr.json();
      setCombos((cdata.combos as Combo[]).map((c) => ({ ...c, price: Number(c.price) })));
      setItems(cdata.items as ComboItem[]);
      setProducts(
        (pdata.products as Product[]).map((p) => ({ ...p, price: Number(p.price) }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function deleteCombo(id: string) {
    if (!confirm("Excluir combo?")) return;
    const r = await fetch(`/api/pdv/combos/${id}`, { method: "DELETE" });
    if (r.ok) refresh();
  }

  return (
    <div className="min-h-screen px-3 sm:px-6 py-4">
      <header className="flex items-center justify-between gap-2 mb-5">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-white">Combos</h1>
          <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
            Visíveis em /{slug} · preço único, lista fixa de itens
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          disabled={products.length === 0}
          title={products.length === 0 ? "Cadastre produtos primeiro" : undefined}
          className="inline-flex items-center gap-1.5 rounded-admin bg-palantir-blue min-h-touch px-3 text-xs font-semibold text-white focus-ring-admin disabled:opacity-40"
        >
          <Plus className="size-4" /> Combo
        </button>
      </header>

      {error && (
        <p className="text-sm text-palantir-red border border-palantir-red/30 bg-palantir-red/10 px-3 py-2 rounded-admin">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mono text-xs text-palantir-muted">carregando...</p>
      ) : products.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-palantir-muted">Nenhum produto cadastrado.</p>
          <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted/60 mt-2">
            cadastre produtos no cardápio antes de criar combos
          </p>
        </div>
      ) : combos.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-palantir-muted">Nenhum combo cadastrado.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {combos.map((c) => {
            const cItems = items.filter((it) => it.combo_id === c.id);
            return (
              <li
                key={c.id}
                className="flex items-start gap-3 rounded-admin border border-palantir-border bg-palantir-surface p-3"
              >
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image_url}
                    alt=""
                    className="size-16 rounded-admin object-cover bg-palantir-bg shrink-0"
                  />
                ) : (
                  <div className="size-16 rounded-admin bg-palantir-bg grid place-items-center text-palantir-muted text-xs shrink-0">
                    ◳
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      c.status === "active" ? "text-white" : "text-palantir-muted line-through"
                    )}
                  >
                    {c.name}
                  </p>
                  {c.description && (
                    <p className="text-xs text-palantir-muted truncate">{c.description}</p>
                  )}
                  <p className="mono text-xs text-palantir-blue mt-0.5">{brl(c.price)}</p>
                  <p className="mono text-[10px] text-palantir-muted mt-1">
                    {cItems
                      .map((it) => `${it.qty}× ${it.name}`)
                      .join(" · ") || "sem itens"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditing(c)}
                    aria-label="Editar"
                    className="grid size-touch place-items-center text-palantir-muted hover:text-palantir-blue focus-ring-admin"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => deleteCombo(c.id)}
                    aria-label="Excluir"
                    className="grid size-touch place-items-center text-palantir-muted hover:text-palantir-red focus-ring-admin"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing !== null && (
        <ComboDialog
          combo={editing === "new" ? null : editing}
          itemsInitial={
            editing === "new"
              ? []
              : items.filter((it) => it.combo_id === (editing as Combo).id)
          }
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ComboDialog({
  combo,
  itemsInitial,
  products,
  onClose,
  onSaved,
}: {
  combo: Combo | null;
  itemsInitial: ComboItem[];
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(combo?.name ?? "");
  const [description, setDescription] = useState(combo?.description ?? "");
  const [price, setPrice] = useState(combo ? String(combo.price) : "");
  const [status, setStatus] = useState<Status>(combo?.status ?? "active");
  const [imageUrl, setImageUrl] = useState<string | null>(combo?.image_url ?? null);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>(
    Object.fromEntries(itemsInitial.map((i) => [i.product_id, i.qty]))
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const selected = Object.entries(qtyMap).filter(([, q]) => q > 0);
  const sumComponents = selected.reduce((s, [pid, q]) => {
    const p = products.find((x) => x.id === pid);
    return s + (p ? Number(p.price) * q : 0);
  }, 0);

  function setQty(id: string, n: number) {
    setQtyMap((m) => ({ ...m, [id]: Math.max(0, Math.min(99, n)) }));
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "combo");
    const r = await fetch("/api/pdv/upload", { method: "POST", body: fd });
    const data = await r.json();
    setUploading(false);
    if (!r.ok) {
      setError(data.error ?? "Falha no upload");
      return;
    }
    setImageUrl(data.url);
  }

  async function save() {
    setError(null);
    const priceNum = Number(price.replace(",", "."));
    if (!name.trim() || isNaN(priceNum) || priceNum < 0) {
      setError("Preencha nome e preço");
      return;
    }
    if (selected.length === 0) {
      setError("Adicione pelo menos 1 item ao combo");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      price: priceNum,
      image_url: imageUrl,
      status,
      items: selected.map(([product_id, qty]) => ({ product_id, qty })),
    };
    const url = combo ? `/api/pdv/combos/${combo.id}` : "/api/pdv/combos";
    const r = await fetch(url, {
      method: combo ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(data.error ?? "Erro ao salvar");
      return;
    }
    onSaved();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl max-h-[92dvh] overflow-y-auto rounded-t-xl sm:rounded-admin border border-palantir-border bg-palantir-surface p-4 sm:p-5 pb-safe"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="mono text-[10px] tracking-widest text-palantir-muted">
              {combo ? "EDITAR COMBO" : "NOVO COMBO"}
            </p>
            <h2 className="text-lg font-semibold text-white">{combo?.name || "Sem nome"}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-touch -mr-2 -mt-1 place-items-center text-palantir-muted hover:text-white focus-ring-admin"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Nome *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch h-11 text-white outline-none focus:border-palantir-blue"
            />
          </Field>
          <Field label="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 text-sm text-white outline-none focus:border-palantir-blue"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço do combo (R$) *">
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="num w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch h-11 text-white outline-none focus:border-palantir-blue"
              />
            </Field>
            <Field label="Status">
              <div className="grid grid-cols-2 gap-1">
                {(["active", "paused"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={cn(
                      "mono text-[10px] uppercase tracking-wider min-h-touch rounded-admin border",
                      status === s
                        ? "border-palantir-blue bg-palantir-blue/10 text-palantir-blue"
                        : "border-palantir-border text-palantir-muted"
                    )}
                  >
                    {s === "active" ? "Ativo" : "Pausado"}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <Field label="Imagem">
            <div className="flex items-center gap-3">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="size-16 rounded-admin object-cover bg-palantir-bg" />
              ) : (
                <div className="size-16 rounded-admin bg-palantir-bg grid place-items-center text-palantir-muted">◳</div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-admin border border-palantir-border min-h-touch px-3 text-xs text-palantir-text hover:bg-palantir-surface2 focus-ring-admin disabled:opacity-40"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {uploading ? "Enviando..." : imageUrl ? "Trocar" : "Enviar"}
              </button>
              {imageUrl && (
                <button
                  onClick={() => setImageUrl(null)}
                  className="mono text-[10px] uppercase text-palantir-muted hover:text-palantir-red focus-ring-admin"
                >
                  Remover
                </button>
              )}
            </div>
          </Field>
          <Field label="Itens do combo *">
            <ul className="rounded-admin border border-palantir-border max-h-64 overflow-y-auto">
              {products.map((p) => {
                const q = qtyMap[p.id] ?? 0;
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 border-b border-palantir-border/50 last:border-b-0",
                      q > 0 && "bg-palantir-blue/5"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-palantir-text truncate">{p.name}</p>
                      <p className="mono text-[10px] text-palantir-muted">{brl(p.price)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setQty(p.id, q - 1)}
                        disabled={q <= 0}
                        aria-label="Menos"
                        className="grid size-8 place-items-center rounded-admin border border-palantir-border text-palantir-text disabled:opacity-30 focus-ring-admin"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="mono w-6 text-center text-sm text-white">{q}</span>
                      <button
                        onClick={() => setQty(p.id, q + 1)}
                        aria-label="Mais"
                        className="grid size-8 place-items-center rounded-admin border border-palantir-border text-palantir-text focus-ring-admin"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {selected.length > 0 && (
              <p className="mono text-[10px] text-palantir-muted mt-1.5">
                Soma dos componentes: {brl(sumComponents)}
                {sumComponents > Number(price.replace(",", ".") || 0) && (
                  <> · <span className="text-somma-green">desconto de {brl(sumComponents - Number(price.replace(",", ".") || 0))}</span></>
                )}
              </p>
            )}
          </Field>
        </div>

        {error && (
          <p className="mt-3 text-sm text-palantir-red border border-palantir-red/30 bg-palantir-red/10 px-3 py-2 rounded-admin">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            onClick={onClose}
            className="mono text-xs text-palantir-muted min-h-touch px-3 focus-ring-admin"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-admin bg-palantir-blue min-h-touch px-4 text-sm font-semibold text-white disabled:opacity-40 focus-ring-admin"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Salvando..." : combo ? "Salvar" : "Criar combo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono text-[10px] uppercase tracking-wider text-palantir-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
