"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, X, Upload, Loader2, Check } from "lucide-react";
import { brl, cn } from "@/lib/utils";

type Status = "active" | "paused" | "out_of_stock";

interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  category_id: string | null;
  status: Status;
  stock_quantity: number | null;
}

export function CardapioView({ slug }: { slug: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [pr, cr] = await Promise.all([
        fetch("/api/pdv/products"),
        fetch("/api/pdv/categories"),
      ]);
      if (!pr.ok || !cr.ok) throw new Error("Falha ao carregar");
      const pdata = await pr.json();
      const cdata = await cr.json();
      setProducts(pdata.products.map((p: Product) => ({ ...p, price: Number(p.price) })));
      setCategories(cdata.categories);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const productsByCategory = useMemo(() => {
    const map = new Map<string | null, Product[]>();
    for (const p of products) {
      const key = p.category_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [products]);

  async function deleteProduct(id: string) {
    if (!confirm("Excluir produto?")) return;
    const r = await fetch(`/api/pdv/products/${id}`, { method: "DELETE" });
    if (r.ok) refresh();
  }

  async function toggleStatus(p: Product) {
    const next: Status = p.status === "active" ? "paused" : "active";
    const r = await fetch(`/api/pdv/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (r.ok) refresh();
  }

  return (
    <div className="min-h-screen px-3 sm:px-6 py-4">
      <header className="flex items-center justify-between gap-2 mb-5">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-white">Cardápio</h1>
          <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
            Produtos visíveis em /{slug}
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-admin bg-palantir-blue min-h-touch px-3 text-xs font-semibold text-white focus-ring-admin"
        >
          <Plus className="size-4" /> Produto
        </button>
      </header>

      <CategoriesPanel
        categories={categories}
        onChanged={refresh}
      />

      {error && (
        <p className="mt-4 text-sm text-palantir-red border border-palantir-red/30 bg-palantir-red/10 px-3 py-2 rounded-admin">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 mono text-xs text-palantir-muted">carregando...</p>
      ) : products.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-palantir-muted">Nenhum produto cadastrado ainda.</p>
          <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted/60 mt-2">
            clique em + produto pra começar
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Sem categoria */}
          {productsByCategory.has(null) && (
            <CategorySection
              title="Sem categoria"
              products={productsByCategory.get(null)!}
              onEdit={(p) => setEditing(p)}
              onDelete={deleteProduct}
              onToggle={toggleStatus}
            />
          )}
          {categories.map((c) => {
            const list = productsByCategory.get(c.id);
            if (!list || list.length === 0) return null;
            return (
              <CategorySection
                key={c.id}
                title={c.name}
                products={list}
                onEdit={(p) => setEditing(p)}
                onDelete={deleteProduct}
                onToggle={toggleStatus}
              />
            );
          })}
        </div>
      )}

      {editing !== null && (
        <ProductDialog
          product={editing === "new" ? null : editing}
          categories={categories}
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

function CategoriesPanel({
  categories,
  onChanged,
}: {
  categories: Category[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    await fetch("/api/pdv/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), sort_order: categories.length }),
    });
    setName("");
    setCreating(false);
    onChanged();
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    await fetch(`/api/pdv/categories/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditingId(null);
    setEditName("");
    onChanged();
  }

  async function remove(id: string) {
    if (!confirm("Excluir categoria? Produtos ficam sem categoria.")) return;
    await fetch(`/api/pdv/categories/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <section className="rounded-admin border border-palantir-border bg-palantir-surface p-3">
      <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted mb-2">
        Categorias
      </p>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) =>
          editingId === c.id ? (
            <div key={c.id} className="flex items-center gap-1">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                autoFocus
                className="rounded-admin border border-palantir-blue bg-palantir-bg px-2 h-8 text-xs text-white outline-none"
              />
              <button onClick={saveEdit} className="grid size-8 place-items-center text-palantir-green focus-ring-admin">
                <Check className="size-4" />
              </button>
              <button
                onClick={() => { setEditingId(null); setEditName(""); }}
                className="grid size-8 place-items-center text-palantir-muted focus-ring-admin"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div
              key={c.id}
              className="group inline-flex items-center gap-1.5 rounded-admin border border-palantir-border bg-palantir-bg pl-3 pr-1 h-8 text-xs text-palantir-text"
            >
              <span>{c.name}</span>
              <button
                onClick={() => { setEditingId(c.id); setEditName(c.name); }}
                className="grid size-6 place-items-center text-palantir-muted hover:text-palantir-blue focus-ring-admin"
                aria-label="Editar categoria"
              >
                <Pencil className="size-3" />
              </button>
              <button
                onClick={() => remove(c.id)}
                className="grid size-6 place-items-center text-palantir-muted hover:text-palantir-red focus-ring-admin"
                aria-label="Excluir categoria"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          )
        )}
        <div className="flex items-center gap-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="nova categoria..."
            className="rounded-admin border border-palantir-border bg-palantir-bg px-2 h-8 text-xs text-white placeholder:text-palantir-muted/60 outline-none focus:border-palantir-blue"
          />
          <button
            onClick={create}
            disabled={!name.trim() || creating}
            className="grid size-8 place-items-center rounded-admin bg-palantir-blue text-white disabled:opacity-40 focus-ring-admin"
            aria-label="Adicionar categoria"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </button>
        </div>
      </div>
    </section>
  );
}

function CategorySection({
  title,
  products,
  onEdit,
  onDelete,
  onToggle,
}: {
  title: string;
  products: Product[];
  onEdit: (p: Product) => void;
  onDelete: (id: string) => void;
  onToggle: (p: Product) => void;
}) {
  return (
    <section>
      <h2 className="mono text-[10px] uppercase tracking-wider text-palantir-muted mb-2">
        {title}
      </h2>
      <ul className="space-y-1.5">
        {products.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-admin border border-palantir-border bg-palantir-surface p-2 sm:p-3"
          >
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image_url}
                alt=""
                className="size-12 sm:size-14 rounded-admin object-cover bg-palantir-bg"
              />
            ) : (
              <div className="size-12 sm:size-14 rounded-admin bg-palantir-bg grid place-items-center text-palantir-muted text-xs">
                ◳
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  p.status === "active" ? "text-white" : "text-palantir-muted line-through"
                )}
              >
                {p.name}
              </p>
              {p.description && (
                <p className="text-xs text-palantir-muted truncate">{p.description}</p>
              )}
              <p className="mono text-xs text-palantir-blue mt-0.5">
                {brl(p.price)}
                {p.stock_quantity != null && (
                  <span
                    className={cn(
                      "ml-2",
                      p.stock_quantity === 0
                        ? "text-palantir-red"
                        : "text-palantir-muted"
                    )}
                  >
                    · estoque {p.stock_quantity}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onToggle(p)}
                title={p.status === "active" ? "Pausar" : "Ativar"}
                className={cn(
                  "mono text-[9px] uppercase tracking-wider min-h-touch px-2 rounded-admin border focus-ring-admin",
                  p.status === "active"
                    ? "border-palantir-green/40 text-palantir-green hover:bg-palantir-green/10"
                    : "border-palantir-yellow/40 text-palantir-yellow hover:bg-palantir-yellow/10"
                )}
              >
                {p.status === "active" ? "Ativo" : p.status === "paused" ? "Pausado" : "S/estoque"}
              </button>
              <button
                onClick={() => onEdit(p)}
                aria-label="Editar"
                className="grid size-touch place-items-center text-palantir-muted hover:text-palantir-blue focus-ring-admin"
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => onDelete(p.id)}
                aria-label="Excluir"
                className="grid size-touch place-items-center text-palantir-muted hover:text-palantir-red focus-ring-admin"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProductDialog({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [categoryId, setCategoryId] = useState<string | null>(product?.category_id ?? null);
  const [status, setStatus] = useState<Status>(product?.status ?? "active");
  const [stock, setStock] = useState(
    product?.stock_quantity != null ? String(product.stock_quantity) : ""
  );
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);
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

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "product");
      const r = await fetch("/api/pdv/upload", { method: "POST", body: fd });
      const data = (await r.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!r.ok || !data.url) {
        setError(data.error ?? "Falha no upload");
        return;
      }
      setImageUrl(data.url);
    } catch {
      setError("Falha de conexão durante o upload");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError(null);
    const priceNum = Number(price.replace(",", "."));
    if (!name.trim() || isNaN(priceNum) || priceNum < 0) {
      setError("Preencha nome e preço válidos");
      return;
    }
    setSaving(true);
    const stockTrim = stock.trim();
    const stockNum =
      stockTrim === "" ? null : Math.max(0, Math.floor(Number(stockTrim)));
    if (stockTrim !== "" && Number.isNaN(Number(stockTrim))) {
      setError("Estoque inválido");
      setSaving(false);
      return;
    }
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      price: priceNum,
      image_url: imageUrl,
      category_id: categoryId,
      status,
      stock_quantity: stockNum,
    };
    const url = product ? `/api/pdv/products/${product.id}` : "/api/pdv/products";
    const method = product ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
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
        className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-xl sm:rounded-admin border border-palantir-border bg-palantir-surface p-4 sm:p-5 pb-safe"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="mono text-[10px] tracking-widest text-palantir-muted">
              {product ? "EDITAR PRODUTO" : "NOVO PRODUTO"}
            </p>
            <h2 className="text-lg font-semibold text-white">
              {product?.name || "Sem nome"}
            </h2>
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
            <Field label="Preço (R$) *">
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="num w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch h-11 text-white outline-none focus:border-palantir-blue"
              />
            </Field>
            <Field label="Categoria">
              <select
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value || null)}
                className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch h-11 text-white outline-none focus:border-palantir-blue"
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Status">
            <div className="grid grid-cols-3 gap-2">
              {(["active", "paused", "out_of_stock"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "mono text-[10px] uppercase tracking-wider min-h-touch rounded-admin border focus-ring-admin",
                    status === s
                      ? "border-palantir-blue bg-palantir-blue/10 text-palantir-blue"
                      : "border-palantir-border text-palantir-muted"
                  )}
                >
                  {s === "active" ? "Ativo" : s === "paused" ? "Pausado" : "S/estoque"}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Estoque (un.)">
            <input
              value={stock}
              onChange={(e) => setStock(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="Vazio = ilimitado"
              aria-describedby="stock-hint"
              className="num w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch h-11 text-white outline-none focus:border-palantir-blue"
            />
            <p id="stock-hint" className="mono text-[10px] text-palantir-muted mt-1">
              Deixe vazio para não controlar estoque. Em 0, o produto bloqueia a venda no app.
            </p>
          </Field>
          <Field label="Imagem">
            <div className="flex items-center gap-3">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="size-16 rounded-admin object-cover bg-palantir-bg" />
              ) : (
                <div className="size-16 rounded-admin bg-palantir-bg grid place-items-center text-palantir-muted">
                  ◳
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
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
            {saving ? "Salvando..." : product ? "Salvar" : "Criar produto"}
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
