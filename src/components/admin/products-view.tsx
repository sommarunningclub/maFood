"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { brl } from "@/lib/utils";
import { PriceEngine } from "@/components/admin/price-engine";

interface PdvLite {
  id: string;
  slug: string;
  name: string;
  logo_url: string;
  commission_pct: number;
  gateway_pct: number;
}

interface ProductRow {
  id: string;
  pdv_id: string;
  category_id: string | null;
  category: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  status: "active" | "paused" | "out_of_stock";
}

interface Category {
  id: string;
  pdv_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

const STATUS_META: Record<ProductRow["status"], { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "text-palantir-green" },
  paused: { label: "Pausado", cls: "text-palantir-yellow" },
  out_of_stock: { label: "Esgotado", cls: "text-palantir-red" },
};

export function ProductsView({
  pdvs,
  initialProducts,
}: {
  pdvs: PdvLite[];
  initialProducts: ProductRow[];
}) {
  const router = useRouter();
  const [pdvFilter, setPdvFilter] = useState("all");
  const [editTarget, setEditTarget] = useState<ProductRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [managingCats, setManagingCats] = useState<PdvLite | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<number>(initialProducts[0]?.price ?? 38);

  const visible = useMemo(
    () =>
      pdvFilter === "all"
        ? initialProducts
        : initialProducts.filter((p) => p.pdv_id === pdvFilter),
    [pdvFilter, initialProducts]
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={pdvFilter}
            onChange={(e) => setPdvFilter(e.target.value)}
            className="rounded-admin border border-palantir-border bg-palantir-surface px-3 py-2 text-sm text-palantir-text"
          >
            <option value="all">Todos os PDVs</option>
            {pdvs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.logo_url} {p.name}
              </option>
            ))}
          </select>
          {pdvFilter !== "all" && (
            <button
              onClick={() => {
                const pdv = pdvs.find((p) => p.id === pdvFilter);
                if (pdv) setManagingCats(pdv);
              }}
              className="mono rounded-admin border border-palantir-border px-3 py-2 text-xs text-palantir-text hover:bg-palantir-surface2"
            >
              GERENCIAR CATEGORIAS
            </button>
          )}
        </div>
        <button
          onClick={() => setCreating(true)}
          className="mono rounded-admin bg-palantir-blue px-3 py-2 text-xs text-white"
        >
          + NOVO PRODUTO
        </button>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div className="border border-palantir-border bg-palantir-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="mono border-b border-palantir-border text-left text-[10px] uppercase tracking-wider text-palantir-muted">
                <th className="w-12 px-3 py-2"></th>
                <th className="px-4 py-2">Produto</th>
                <th className="px-4 py-2">PDV</th>
                <th className="px-4 py-2">Categoria</th>
                <th className="px-4 py-2">Preço</th>
                <th className="px-4 py-2">Status</th>
                <th className="w-16 px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const pdv = pdvs.find((x) => x.id === p.pdv_id);
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPrice(p.price)}
                    className="cursor-pointer border-t border-palantir-border hover:bg-palantir-surface2"
                  >
                    <td className="px-3 py-2">
                      <div className="size-9 rounded-admin bg-palantir-surface2 border border-palantir-border overflow-hidden flex items-center justify-center">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image_url} alt={p.name} className="size-full object-cover" />
                        ) : (
                          <span className="text-palantir-muted text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-palantir-text">
                      <div>{p.name}</div>
                      {p.description && (
                        <div className="text-[10px] text-palantir-muted truncate max-w-[280px]">
                          {p.description}
                        </div>
                      )}
                    </td>
                    <td className="mono px-4 py-2 text-palantir-muted">
                      {pdv ? `${pdv.logo_url} ${pdv.name}` : "—"}
                    </td>
                    <td className="mono px-4 py-2 text-palantir-muted">{p.category || "—"}</td>
                    <td className="mono px-4 py-2 text-palantir-text">{brl(p.price)}</td>
                    <td className={`mono px-4 py-2 ${STATUS_META[p.status].cls}`}>
                      {STATUS_META[p.status].label}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTarget(p);
                        }}
                        title="Editar produto"
                        className="rounded-admin border border-palantir-border px-2 py-1 text-xs text-palantir-text hover:bg-palantir-surface2"
                      >
                        ✎
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-palantir-muted text-sm">
                    Nenhum produto. Clique em &ldquo;+ Novo Produto&rdquo; para começar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Engine de precificação</h2>
          <PriceEngine key={selectedPrice} initial={selectedPrice} />
        </div>
      </div>

      {creating && (
        <ProductDialog
          pdvs={pdvs}
          defaultPdv={pdvFilter !== "all" ? pdvFilter : pdvs[0]?.id}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}

      {editTarget && (
        <ProductDialog
          pdvs={pdvs}
          product={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            router.refresh();
          }}
        />
      )}

      {managingCats && (
        <CategoriesDialog
          pdv={managingCats}
          onClose={() => setManagingCats(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </>
  );
}

// ─── Product dialog (create / edit) ───────────────────────────────

function ProductDialog({
  pdvs,
  defaultPdv,
  product,
  onClose,
  onSaved,
}: {
  pdvs: PdvLite[];
  defaultPdv?: string;
  product?: ProductRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!product;
  const [pdvId, setPdvId] = useState(product?.pdv_id ?? defaultPdv ?? pdvs[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState<string | "">(product?.category_id ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState<number>(product?.price ?? 0);
  const [status, setStatus] = useState<ProductRow["status"]>(product?.status ?? "active");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Carrega categorias do PDV selecionado
  useEffect(() => {
    if (!pdvId) return;
    fetch(`/api/admin/categories?pdv_id=${pdvId}`)
      .then((r) => r.json())
      .then((d) => setCategories(d.items ?? []))
      .catch(() => setCategories([]));
  }, [pdvId]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pdvId) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("pdv_id", pdvId);
    form.append("kind", "product");
    const r = await fetch("/api/admin/upload", { method: "POST", body: form });
    setUploading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error ?? "Falha no upload");
      return;
    }
    const data = await r.json();
    setImageUrl(data.url);
  }

  async function createCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed || !pdvId) return;
    const r = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdv_id: pdvId, name: trimmed }),
    });
    if (r.ok) {
      const data = await r.json();
      const item = { id: data.id, pdv_id: pdvId, name: trimmed, sort_order: 999, is_active: true };
      setCategories((c) => [...c, item]);
      setCategoryId(data.id);
      setNewCategory("");
    }
  }

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Nome obrigatorio");
    if (!pdvId) return setError("PDV obrigatorio");
    if (price < 0) return setError("Preço invalido");

    setLoading(true);
    const payload = {
      pdv_id: pdvId,
      category_id: categoryId || null,
      name: name.trim(),
      description: description.trim(),
      price,
      image_url: imageUrl,
      status,
    };
    const url = editing ? `/api/admin/products/${product!.id}` : "/api/admin/products";
    const method = editing ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error ?? "Erro");
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!product) return;
    if (!confirm(`Excluir "${product.name}"?`)) return;
    const r = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    if (r.ok) onSaved();
  }

  return (
    <Modal onClose={onClose} wide>
      <p className="mono text-[10px] tracking-widest text-palantir-muted">
        {editing ? "EDITAR PRODUTO" : "NOVO PRODUTO"}
      </p>
      <h2 className="text-lg font-semibold text-white mb-4">{name || "Novo produto"}</h2>

      <div className="grid grid-cols-[140px_1fr] gap-4">
        {/* Imagem */}
        <div>
          <Field label="Imagem">
            <div className="aspect-square rounded-admin bg-palantir-bg border border-palantir-border overflow-hidden flex items-center justify-center">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-palantir-muted text-3xl">🍽</span>
              )}
            </div>
          </Field>
          <label className="mono mt-2 block cursor-pointer rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 text-center text-[10px] uppercase text-palantir-text hover:bg-palantir-surface2">
            {uploading ? "Enviando..." : imageUrl ? "Trocar imagem" : "Enviar imagem"}
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading || !pdvId} />
          </label>
          {imageUrl && (
            <button
              onClick={() => setImageUrl("")}
              className="mono mt-1 w-full text-[10px] uppercase text-palantir-red"
            >
              Remover
            </button>
          )}
        </div>

        {/* Form */}
        <div className="space-y-3">
          <Field label="PDV">
            <select
              value={pdvId}
              onChange={(e) => {
                setPdvId(e.target.value);
                setCategoryId("");
              }}
              disabled={editing}
              className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white disabled:opacity-60"
            >
              {pdvs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.logo_url} {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nome">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
              autoFocus
            />
          </Field>

          <Field label="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 text-sm text-white"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço (R$)">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                min={0}
                step={0.5}
                className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
              />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductRow["status"])}
                className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
              >
                <option value="active">Ativo</option>
                <option value="paused">Pausado</option>
                <option value="out_of_stock">Esgotado</option>
              </select>
            </Field>
          </div>

          <Field label="Categoria">
            <div className="space-y-2">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-white"
              >
                <option value="">— Sem categoria —</option>
                {categories.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="+ Criar nova categoria"
                  className="flex-1 rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-sm text-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      createCategory();
                    }
                  }}
                />
                <button
                  onClick={createCategory}
                  disabled={!newCategory.trim() || !pdvId}
                  className="mono rounded-admin border border-palantir-blue px-3 h-9 text-[10px] uppercase text-palantir-blue disabled:opacity-40"
                >
                  Criar
                </button>
              </div>
            </div>
          </Field>
        </div>
      </div>

      {error && <p className="mono mt-3 text-xs text-palantir-red">{error}</p>}

      <div className="mt-5 flex items-center justify-between">
        <div>
          {editing && (
            <button onClick={remove} className="mono text-xs text-palantir-red hover:underline">
              Excluir produto
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="mono text-xs text-palantir-muted px-3 py-2">
            cancelar
          </button>
          <button
            onClick={save}
            disabled={loading || uploading}
            className="rounded-admin bg-palantir-blue px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {loading ? "Salvando..." : editing ? "Salvar alterações" : "Criar produto"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Categories dialog ─────────────────────────────────────────────

function CategoriesDialog({
  pdv,
  onClose,
  onChanged,
}: {
  pdv: PdvLite;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [cats, setCats] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/categories?pdv_id=${pdv.id}`)
      .then((r) => r.json())
      .then((d) => {
        setCats(d.items ?? []);
        setLoading(false);
      });
  }, [pdv.id]);

  async function create() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const r = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdv_id: pdv.id, name: trimmed }),
    });
    if (r.ok) {
      const data = await r.json();
      setCats((c) => [...c, {
        id: data.id, pdv_id: pdv.id, name: trimmed,
        sort_order: c.length, is_active: true,
      }]);
      setNewName("");
      onChanged();
    }
  }

  async function update(id: string, patch: Partial<Category>) {
    setCats((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    onChanged();
  }

  async function remove(id: string) {
    if (!confirm("Excluir categoria? Produtos ligados ficarão sem categoria.")) return;
    setCats((c) => c.filter((x) => x.id !== id));
    await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <Modal onClose={onClose}>
      <p className="mono text-[10px] tracking-widest text-palantir-muted">CATEGORIAS</p>
      <h2 className="text-lg font-semibold text-white">{pdv.name}</h2>
      <p className="mono text-[11px] text-palantir-muted mb-4">
        {pdv.logo_url} {pdv.slug}
      </p>

      <div className="space-y-1.5 max-h-80 overflow-auto term-scroll">
        {loading && <p className="mono text-[10px] text-palantir-muted">carregando...</p>}
        {!loading && cats.length === 0 && (
          <p className="mono text-[10px] text-palantir-muted">Nenhuma categoria ainda.</p>
        )}
        {cats.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2 rounded-admin border border-palantir-border bg-palantir-bg px-2 py-1.5"
          >
            <input
              defaultValue={c.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.name) update(c.id, { name: v });
              }}
              className="flex-1 bg-transparent text-sm text-white outline-none"
            />
            <button
              onClick={() => update(c.id, { is_active: !c.is_active })}
              className={`mono px-2 py-0.5 text-[9px] uppercase ${
                c.is_active
                  ? "bg-palantir-green/15 text-palantir-green"
                  : "bg-palantir-muted/15 text-palantir-muted"
              }`}
            >
              {c.is_active ? "ATIVA" : "INATIVA"}
            </button>
            <button
              onClick={() => remove(c.id)}
              className="mono text-[12px] text-palantir-red hover:underline"
              title="Excluir"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome da nova categoria"
          className="flex-1 rounded-admin border border-palantir-border bg-palantir-bg px-3 h-9 text-sm text-white"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
          }}
        />
        <button
          onClick={create}
          disabled={!newName.trim()}
          className="rounded-admin bg-palantir-blue px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          + Adicionar
        </button>
      </div>

      <div className="mt-5 flex justify-end">
        <button onClick={onClose} className="mono text-xs text-palantir-muted px-3 py-2">
          Fechar
        </button>
      </div>
    </Modal>
  );
}

// ─── shared ────────────────────────────────────────────────────────

function Modal({
  children,
  onClose,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full rounded-admin border border-palantir-border bg-palantir-surface p-5 ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono text-[11px] text-palantir-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
