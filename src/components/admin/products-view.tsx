"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  X,
  Trash2,
  Sparkles,
  CreditCard,
  Clock3,
  Zap,
  ArrowUpRight,
  Info,
  Eye,
  EyeOff,
} from "lucide-react";
import { brl } from "@/lib/utils";
import { PriceEngine } from "@/components/admin/price-engine";
import { isImageLogo } from "@/components/pdv-logo";
import { MoneyInput } from "@/components/money-input";
import {
  ceilToCharmPrice,
  effectivePrice,
  roundToCharmPrice,
} from "@/lib/pricing";
import type { AsaasAccountFees } from "@/lib/asaas";
import {
  cardSettlementDays,
  estimateCardAnticipation,
  estimateCardFee,
  estimatePixFee,
  priceForAnticipatedCardNet,
} from "@/lib/asaas-fees";

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
  stock_quantity: number | null;
  supplier_cost: number | null;
  sale_price: number | null;
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
  paused: { label: "Oculto", cls: "text-palantir-yellow" },
  out_of_stock: { label: "Esgotado", cls: "text-palantir-red" },
};

export function ProductsView({
  pdvs,
  initialProducts,
  asaasFees,
}: {
  pdvs: PdvLite[];
  initialProducts: ProductRow[];
  asaasFees: AsaasAccountFees | null;
}) {
  const router = useRouter();
  const [localProducts, setLocalProducts] = useState<ProductRow[]>(initialProducts);
  const [pdvFilter, setPdvFilter] = useState("all");
  const [editTarget, setEditTarget] = useState<ProductRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [managingCats, setManagingCats] = useState<PdvLite | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<number>(initialProducts[0]?.price ?? 38);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"category" | "pdv" | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<ProductRow[] | null>(null);

  // Keep localProducts in sync when the server refreshes initialProducts
  useEffect(() => {
    setLocalProducts(initialProducts);
  }, [initialProducts]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll(ids: string[]) {
    setSelected((s) => {
      const allOn = ids.every((id) => s.has(id));
      return allOn ? new Set() : new Set(ids);
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }

  // Ocultar = status "paused" (o cardápio do cliente já filtra active/out_of_stock).
  // Toggle otimista: some/aparece na hora, com revert se a API falhar.
  async function toggleHidden(p: ProductRow) {
    const next: ProductRow["status"] = p.status === "paused" ? "active" : "paused";
    const prevStatus = p.status;
    setLocalProducts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, status: next } : x))
    );
    const r = await fetch(`/api/admin/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);
    if (!r || !r.ok) {
      setLocalProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, status: prevStatus } : x))
      );
      return;
    }
    router.refresh();
  }

  const visible = useMemo(
    () =>
      pdvFilter === "all"
        ? localProducts
        : localProducts.filter((p) => p.pdv_id === pdvFilter),
    [pdvFilter, localProducts]
  );

  const stockSummary = useMemo(() => {
    let cost = 0;
    let sale = 0;
    let units = 0;
    let tracked = 0;
    for (const p of visible) {
      if (p.stock_quantity == null) continue;
      tracked += 1;
      units += p.stock_quantity;
      // Projeção de venda usa o preço que o cliente realmente paga
      // (sale_price/"Preço de venda" quando preenchido; senão o "Preço" base).
      sale += effectivePrice(p) * p.stock_quantity;
      if (p.supplier_cost != null) cost += p.supplier_cost * p.stock_quantity;
    }
    return { cost, sale, profit: sale - cost, units, tracked };
  }, [visible]);

  return (
    <>
      {/* Toolbar — empilha em mobile */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            value={pdvFilter}
            onChange={(e) => setPdvFilter(e.target.value)}
            className="rounded-admin border border-palantir-border bg-palantir-surface px-3 min-h-touch text-sm text-palantir-text focus-ring-admin"
          >
            <option value="all">Todos os PDVs</option>
            {pdvs.map((p) => (
              <option key={p.id} value={p.id}>
                {isImageLogo(p.logo_url) ? "🖼" : p.logo_url} {p.name}
              </option>
            ))}
          </select>
          {pdvFilter !== "all" && (
            <button
              onClick={() => {
                const pdv = pdvs.find((p) => p.id === pdvFilter);
                if (pdv) setManagingCats(pdv);
              }}
              className="mono rounded-admin border border-palantir-border px-3 min-h-touch text-xs text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
            >
              GERENCIAR CATEGORIAS
            </button>
          )}
        </div>
        <button
          onClick={() => setCreating(true)}
          className="mono inline-flex items-center justify-center gap-1.5 rounded-admin bg-palantir-blue px-3 min-h-touch text-xs text-white focus-ring-admin"
        >
          <Plus className="size-3.5" /> NOVO PRODUTO
        </button>
      </div>

      {/* Resumo financeiro do estoque visível */}
      {stockSummary.tracked > 0 && (
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <SummaryCard
            label="Itens com estoque"
            value={`${stockSummary.tracked}`}
            sub={`${stockSummary.units} un total`}
          />
          <SummaryCard
            label="Valor em estoque"
            value={brl(stockSummary.cost)}
            sub="custo de aquisição"
            tone="muted"
          />
          <SummaryCard
            label="Previsão de venda"
            value={brl(stockSummary.sale)}
            sub="se vender tudo"
            tone="blue"
          />
          <SummaryCard
            label="Lucro previsto"
            value={brl(stockSummary.profit)}
            sub={
              stockSummary.cost > 0
                ? `${((stockSummary.profit / stockSummary.cost) * 100).toFixed(1)}% sobre custo`
                : "—"
            }
            tone={stockSummary.profit >= 0 ? "green" : "red"}
          />
        </div>
      )}

      {/* Grid: produtos + price engine. Price engine empurra para baixo em <xl */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4 xl:gap-6">
        {/* ── Tabela desktop ──────────────────────────────── */}
        <div className="hidden md:block border border-palantir-border bg-palantir-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="mono border-b border-palantir-border text-left text-[10px] uppercase tracking-wider text-palantir-muted">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos"
                    checked={visible.length > 0 && visible.every((p) => selected.has(p.id))}
                    ref={(el) => {
                      if (el) {
                        const some = visible.some((p) => selected.has(p.id));
                        const all = visible.length > 0 && visible.every((p) => selected.has(p.id));
                        el.indeterminate = some && !all;
                      }
                    }}
                    onChange={() => toggleAll(visible.map((p) => p.id))}
                    className="size-4 accent-palantir-blue cursor-pointer"
                  />
                </th>
                <th className="w-12 px-3 py-2"></th>
                <th className="px-4 py-2">Produto</th>
                <th className="px-4 py-2">PDV</th>
                <th className="px-4 py-2">Categoria</th>
                <th className="px-4 py-2">Preço</th>
                <th className="px-4 py-2">Estoque</th>
                <th className="px-4 py-2">Prev. venda</th>
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
                    onClick={() => {
                      const fresh = localProducts.find((x) => x.id === p.id) ?? p;
                      setSelectedPrice(fresh.price);
                      setEditTarget(fresh);
                    }}
                    className={`cursor-pointer border-t border-palantir-border hover:bg-palantir-surface2 ${
                      selected.has(p.id) ? "bg-palantir-blue/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${p.name}`}
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="size-4 accent-palantir-blue cursor-pointer"
                      />
                    </td>
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
                    <td className="mono px-4 py-2 text-palantir-muted whitespace-nowrap">
                      {pdv ? `${isImageLogo(pdv.logo_url) ? "🖼" : pdv.logo_url} ${pdv.name}` : "—"}
                    </td>
                    <td className="mono px-4 py-2 text-palantir-muted">{p.category || "—"}</td>
                    <td className="mono px-4 py-2 text-palantir-text whitespace-nowrap">{brl(p.price)}</td>
                    <td className="mono px-4 py-2 whitespace-nowrap">
                      {p.stock_quantity == null ? (
                        <span className="text-palantir-muted">∞</span>
                      ) : (
                        <span className={p.stock_quantity === 0 ? "text-palantir-red" : p.stock_quantity <= 5 ? "text-palantir-yellow" : "text-palantir-text"}>
                          {p.stock_quantity}
                        </span>
                      )}
                    </td>
                    <td className="mono px-4 py-2 whitespace-nowrap text-palantir-muted">
                      {p.stock_quantity != null ? brl(effectivePrice(p) * p.stock_quantity) : "—"}
                    </td>
                    <td className={`mono px-4 py-2 whitespace-nowrap ${STATUS_META[p.status].cls}`}>
                      {STATUS_META[p.status].label}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const fresh = localProducts.find((x) => x.id === p.id) ?? p;
                            setSelectedPrice(fresh.price);
                            setEditTarget(fresh);
                          }}
                          aria-label={`Editar ${p.name}`}
                          className="grid size-9 place-items-center rounded-admin border border-palantir-border text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleHidden(localProducts.find((x) => x.id === p.id) ?? p);
                          }}
                          aria-label={
                            p.status === "paused"
                              ? `Mostrar ${p.name} no cardápio`
                              : `Ocultar ${p.name} do cardápio`
                          }
                          title={
                            p.status === "paused"
                              ? "Mostrar no cardápio"
                              : "Ocultar do cardápio"
                          }
                          className="grid size-9 place-items-center rounded-admin border border-palantir-border text-palantir-muted hover:bg-palantir-surface2 hover:text-palantir-text focus-ring-admin"
                        >
                          {p.status === "paused" ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTargets([localProducts.find((x) => x.id === p.id) ?? p]);
                          }}
                          aria-label={`Excluir ${p.name}`}
                          className="grid size-9 place-items-center rounded-admin border border-palantir-border text-palantir-muted hover:bg-palantir-red/10 hover:text-palantir-red hover:border-palantir-red/40 focus-ring-admin"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-palantir-muted text-sm">
                    Nenhum produto. Clique em &ldquo;+ Novo Produto&rdquo; para começar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Cards mobile ─────────────────────────────────── */}
        <ul className="md:hidden space-y-2">
          {visible.map((p) => {
            const pdv = pdvs.find((x) => x.id === p.pdv_id);
            return (
              <li
                key={p.id}
                onClick={() => setEditTarget(localProducts.find((x) => x.id === p.id) ?? p)}
                className={`border border-palantir-border p-3 flex gap-3 cursor-pointer ${
                  selected.has(p.id) ? "bg-palantir-blue/10" : "bg-palantir-surface"
                }`}
              >
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${p.name}`}
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="size-5 accent-palantir-blue cursor-pointer self-center"
                />
                <div className="size-16 shrink-0 rounded-admin bg-palantir-surface2 border border-palantir-border overflow-hidden flex items-center justify-center">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="size-full object-cover" />
                  ) : (
                    <span className="text-palantir-muted text-xs">—</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-palantir-text text-sm font-medium truncate">{p.name}</p>
                      <p className="mono text-[10px] text-palantir-muted truncate">
                        {pdv ? `${isImageLogo(pdv.logo_url) ? "🖼" : pdv.logo_url} ${pdv.name}` : "—"}
                        {p.category && <> · {p.category}</>}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTarget(localProducts.find((x) => x.id === p.id) ?? p);
                        }}
                        aria-label={`Editar ${p.name}`}
                        className="grid size-touch place-items-center rounded-admin border border-palantir-border text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleHidden(localProducts.find((x) => x.id === p.id) ?? p);
                        }}
                        aria-label={
                          p.status === "paused"
                            ? `Mostrar ${p.name} no cardápio`
                            : `Ocultar ${p.name} do cardápio`
                        }
                        className="grid size-touch place-items-center rounded-admin border border-palantir-border text-palantir-muted hover:bg-palantir-surface2 hover:text-palantir-text focus-ring-admin"
                      >
                        {p.status === "paused" ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargets([localProducts.find((x) => x.id === p.id) ?? p]);
                        }}
                        aria-label={`Excluir ${p.name}`}
                        className="grid size-touch place-items-center rounded-admin border border-palantir-border text-palantir-muted hover:bg-palantir-red/10 hover:text-palantir-red hover:border-palantir-red/40 focus-ring-admin"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="mono text-sm text-palantir-text">
                      {brl(p.price)}
                      {p.stock_quantity != null && (
                        <>
                          <span className={`ml-2 text-[10px] ${p.stock_quantity === 0 ? "text-palantir-red" : p.stock_quantity <= 5 ? "text-palantir-yellow" : "text-palantir-muted"}`}>
                            · {p.stock_quantity} un
                          </span>
                          <span className="ml-2 text-[10px] text-palantir-blue">
                            · {brl(effectivePrice(p) * p.stock_quantity)}
                          </span>
                        </>
                      )}
                    </span>
                    <span className={`mono text-[10px] uppercase ${STATUS_META[p.status].cls}`}>
                      {STATUS_META[p.status].label}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="border border-palantir-border bg-palantir-surface p-6 text-center text-sm text-palantir-muted">
              Nenhum produto ainda
            </li>
          )}
        </ul>

        {/* Price engine — colapsável em <xl */}
        <details className="xl:hidden border border-palantir-border bg-palantir-surface">
          <summary className="mono cursor-pointer list-none px-4 py-3 text-xs uppercase tracking-wider text-palantir-text flex items-center justify-between focus-ring-admin">
            <span>Engine de precificação</span>
            <span className="text-palantir-muted">▾</span>
          </summary>
          <div className="border-t border-palantir-border p-3">
            <PriceEngine key={selectedPrice} initial={selectedPrice} />
          </div>
        </details>

        <div className="hidden xl:block">
          <h2 className="mb-3 text-sm font-semibold text-white">Engine de precificação</h2>
          <PriceEngine key={selectedPrice} initial={selectedPrice} />
        </div>
      </div>

      {/* Barra de ações em massa — sticky no rodapé */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-admin border border-palantir-blue bg-palantir-bg px-3 py-2 shadow-lg pb-safe">
          <span className="mono text-xs text-palantir-text whitespace-nowrap">
            {selected.size} selecionado{selected.size > 1 ? "s" : ""}
          </span>
          <span className="text-palantir-border">|</span>
          <button
            onClick={() => setBulkAction("category")}
            className="mono rounded-admin border border-palantir-border px-3 min-h-touch text-[10px] uppercase text-palantir-text hover:bg-palantir-surface focus-ring-admin"
          >
            Adicionar à categoria
          </button>
          <button
            onClick={() => setBulkAction("pdv")}
            className="mono rounded-admin border border-palantir-border px-3 min-h-touch text-[10px] uppercase text-palantir-text hover:bg-palantir-surface focus-ring-admin"
          >
            Mover p/ PDV
          </button>
          <button
            onClick={() =>
              setDeleteTargets(localProducts.filter((p) => selected.has(p.id)))
            }
            className="mono rounded-admin border border-palantir-red/50 px-3 min-h-touch text-[10px] uppercase text-palantir-red hover:bg-palantir-red/10 focus-ring-admin"
          >
            Excluir
          </button>
          <button
            onClick={clearSelection}
            aria-label="Cancelar seleção"
            className="grid size-touch place-items-center text-palantir-muted hover:text-palantir-text focus-ring-admin"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {bulkAction && (
        <BulkMoveDialog
          mode={bulkAction}
          ids={Array.from(selected)}
          products={localProducts}
          pdvs={pdvs}
          onClose={() => setBulkAction(null)}
          onDone={(patch) => {
            setLocalProducts((prev) =>
              prev.map((p) =>
                selected.has(p.id) ? { ...p, ...patch } : p
              )
            );
            setBulkAction(null);
            clearSelection();
            router.refresh();
          }}
        />
      )}

      {deleteTargets && (
        <DeleteProductsDialog
          products={deleteTargets}
          onClose={() => setDeleteTargets(null)}
          onDeleted={(deletedIds) => {
            setLocalProducts((prev) => prev.filter((p) => !deletedIds.includes(p.id)));
            setDeleteTargets(null);
            clearSelection();
            router.refresh();
          }}
        />
      )}

      {creating && (
        <ProductDialog
          pdvs={pdvs}
          asaasFees={asaasFees}
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
          asaasFees={asaasFees}
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
  asaasFees,
  defaultPdv,
  product,
  onClose,
  onSaved,
}: {
  pdvs: PdvLite[];
  asaasFees: AsaasAccountFees | null;
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
  const [trackStock, setTrackStock] = useState<boolean>(product?.stock_quantity != null);
  const [stockQty, setStockQty] = useState<number>(product?.stock_quantity ?? 0);
  const [supplierCost, setSupplierCost] = useState<number>(product?.supplier_cost ?? 0);
  const [salePrice, setSalePrice] = useState<number>(product?.sale_price ?? 0);
  const [boxSize, setBoxSize] = useState<number>(12);
  const [boxQty, setBoxQty] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    try {
      const r = await fetch("/api/admin/upload", { method: "POST", body: form });
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
    if (!name.trim()) return setError("Nome obrigatório");
    if (!pdvId) return setError("PDV obrigatório");
    if (price < 0) return setError("Preço inválido");

    const charmingPrice = price > 0 ? roundToCharmPrice(price) : 0;
    const charmingSale = salePrice > 0 ? roundToCharmPrice(salePrice) : 0;
    if (charmingPrice !== price) setPrice(charmingPrice);
    if (charmingSale !== salePrice) setSalePrice(charmingSale);

    setLoading(true);
    const payload = {
      pdv_id: pdvId,
      category_id: categoryId || null,
      name: name.trim(),
      description: description.trim(),
      price: charmingPrice,
      image_url: imageUrl,
      status,
      stock_quantity: trackStock ? Math.max(0, Math.floor(stockQty)) : null,
      supplier_cost: supplierCost > 0 ? supplierCost : null,
      sale_price: charmingSale > 0 ? charmingSale : null,
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
    <Modal onClose={onClose} title={editing ? `Editar — ${product!.name}` : "Novo produto"} wide>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)] md:gap-6 xl:gap-8">
        {/* Imagem */}
        <div className="md:sticky md:top-0 md:self-start">
          <Field label="Imagem">
            <div className="aspect-square w-full max-w-[220px] mx-auto md:max-w-none rounded-2xl bg-palantir-bg border border-palantir-border overflow-hidden flex items-center justify-center">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-palantir-muted text-3xl">🍽</span>
              )}
            </div>
          </Field>
          <label className="mono mt-2 block cursor-pointer rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch grid place-items-center text-[10px] uppercase text-palantir-text hover:bg-palantir-surface2 focus-within:outline focus-within:outline-2 focus-within:outline-palantir-blue">
            {uploading ? "Enviando..." : imageUrl ? "Trocar imagem" : "Enviar imagem"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFile}
              disabled={uploading || !pdvId}
            />
          </label>
          {imageUrl && (
            <button
              onClick={() => setImageUrl("")}
              className="mono mt-1 w-full min-h-touch text-[10px] uppercase text-palantir-red focus-ring-admin"
            >
              Remover
            </button>
          )}
        </div>

        {/* Form */}
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="PDV">
              <select
                value={pdvId}
                onChange={(e) => {
                  setPdvId(e.target.value);
                  setCategoryId("");
                }}
                disabled={editing}
                className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white disabled:opacity-60 focus-ring-admin"
              >
                {pdvs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {isImageLogo(p.logo_url) ? "🖼" : p.logo_url} {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductRow["status"])}
                className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
              >
                <option value="active">Ativo</option>
                <option value="paused">Oculto</option>
                <option value="out_of_stock">Esgotado</option>
              </select>
            </Field>
          </div>

          <Field label="Nome">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
              autoFocus
            />
          </Field>

          <Field label="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 py-2 text-sm text-white focus-ring-admin"
            />
          </Field>

          <Field label="Preço (R$)">
            <MoneyInput
              value={price}
              onChange={setPrice}
              onBlur={() => {
                if (price > 0) setPrice(roundToCharmPrice(price));
              }}
              className="mono w-full max-w-xs rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
            />
            <p className="mono mt-1 text-[10px] text-palantir-muted">
              Fecha em ,00 ou ,99 na saída do campo (visão do consumidor).
            </p>
          </Field>

          <PaymentFeeSimulator
            value={salePrice > 0 ? salePrice : Number(price)}
            fees={asaasFees}
          />

          <Field label="Estoque">
            <div className="space-y-2">
              <label className="mono flex items-center gap-2 text-[11px] text-palantir-text">
                <input
                  type="checkbox"
                  checked={trackStock}
                  onChange={(e) => setTrackStock(e.target.checked)}
                  className="size-4 accent-palantir-blue"
                />
                Controlar quantidade em estoque
              </label>
              {trackStock ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStockQty((q) => Math.max(0, q - 1))}
                    className="mono grid size-touch place-items-center rounded-admin border border-palantir-border text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
                    aria-label="Diminuir"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={stockQty}
                    onChange={(e) => setStockQty(Math.max(0, Number(e.target.value) || 0))}
                    min={0}
                    step={1}
                    className="mono w-24 rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-center text-white focus-ring-admin"
                  />
                  <button
                    type="button"
                    onClick={() => setStockQty((q) => q + 1)}
                    className="mono grid size-touch place-items-center rounded-admin border border-palantir-border text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
                    aria-label="Aumentar"
                  >
                    +
                  </button>
                  <span className="mono text-[10px] text-palantir-muted">
                    unidades disponíveis
                  </span>
                </div>
              ) : (
                <p className="mono text-[10px] text-palantir-muted">
                  Sem controle de estoque (ilimitado)
                </p>
              )}

              {trackStock && (
                <div className="rounded-admin border border-palantir-border bg-palantir-bg p-2 space-y-2">
                  <div className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
                    Entrada por caixa (consignado)
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-1">
                    <label className="block">
                      <span className="mono text-[9px] text-palantir-muted block mb-1">Unid/caixa</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={boxSize}
                        onChange={(e) => setBoxSize(Math.max(1, Number(e.target.value) || 1))}
                        min={1}
                        className="mono w-full rounded-admin border border-palantir-border bg-palantir-surface px-2 min-h-touch text-center text-white focus-ring-admin"
                      />
                    </label>
                    <span className="mono text-palantir-muted pb-2">×</span>
                    <label className="block">
                      <span className="mono text-[9px] text-palantir-muted block mb-1">Caixas</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={boxQty}
                        onChange={(e) => setBoxQty(Math.max(0, Number(e.target.value) || 0))}
                        min={0}
                        className="mono w-full rounded-admin border border-palantir-border bg-palantir-surface px-2 min-h-touch text-center text-white focus-ring-admin"
                      />
                    </label>
                    <span className="mono text-palantir-muted pb-2">=</span>
                    <div className="text-center pb-1">
                      <span className="mono text-[9px] text-palantir-muted block mb-1">Total</span>
                      <span className="mono text-base font-semibold text-palantir-blue">
                        {boxSize * boxQty}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const add = boxSize * boxQty;
                      if (add > 0) {
                        setStockQty((q) => q + add);
                        setBoxQty(0);
                      }
                    }}
                    disabled={boxSize * boxQty === 0}
                    className="mono w-full rounded-admin border border-palantir-blue bg-palantir-blue/10 min-h-touch text-[10px] uppercase tracking-wider text-palantir-blue hover:bg-palantir-blue/20 disabled:opacity-40 disabled:hover:bg-palantir-blue/10 focus-ring-admin"
                  >
                    + Somar {boxSize * boxQty} ao estoque
                  </button>
                </div>
              )}
            </div>
          </Field>

          {pdvs.find((p) => p.id === pdvId)?.slug === "somma-bear" && (
            <div className="rounded-admin border border-palantir-blue/40 bg-palantir-blue/5 p-3 space-y-3">
              <div className="mono text-[10px] uppercase tracking-wider text-palantir-blue">
                Precificação Somma Bear
              </div>
              <Field label="Custo Fornecedor (R$)">
                <MoneyInput
                  value={supplierCost}
                  onChange={setSupplierCost}
                  className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
                />
              </Field>
              <Field label="Preço de venda (R$)">
                <MoneyInput
                  value={salePrice}
                  onChange={setSalePrice}
                  onBlur={() => {
                    if (salePrice > 0) setSalePrice(roundToCharmPrice(salePrice));
                  }}
                  className="mono w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
                />
                <p className="mono mt-1 text-[10px] text-palantir-muted">
                  {salePrice > 0
                    ? "Este é o preço mostrado e cobrado do cliente (,00 ou ,99)."
                    : `Vazio: o cliente vê o Preço (R$) — ${brl(Number(price) || 0)}.`}
                </p>
              </Field>
              {(() => {
                const cost = supplierCost;
                const sale = salePrice > 0 ? salePrice : Number(price);
                if (!cost || !sale || cost <= 0 || sale <= 0) {
                  return (
                    <p className="mono text-[10px] text-palantir-muted">
                      Informe custo e preço de venda pra ver lucro e margens.
                    </p>
                  );
                }
                const profit = sale - cost;
                const marginCost = (profit / cost) * 100;
                const marginSale = (profit / sale) * 100;
                const pixFee = estimatePixFee(sale, asaasFees?.payment?.pix);
                const cardFee = estimateCardFee(
                  sale,
                  asaasFees?.payment?.creditCard
                );
                const cardAnticipation = estimateCardAnticipation(
                  sale,
                  asaasFees?.payment?.creditCard,
                  asaasFees?.anticipation?.creditCard
                );
                const fmt = (n: number) =>
                  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const profitCls = profit < 0 ? "text-palantir-red" : "text-palantir-green";
                return (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-admin border border-palantir-border bg-palantir-bg p-2">
                        <div className="mono text-[9px] uppercase text-palantir-muted">
                          Lucro bruto
                        </div>
                        <div className={`mono text-sm font-semibold ${profitCls}`}>
                          R$ {fmt(profit)}
                        </div>
                      </div>
                      <div className="rounded-admin border border-palantir-border bg-palantir-bg p-2">
                        <div className="mono text-[9px] uppercase text-palantir-muted">Margem custo</div>
                        <div className={`mono text-sm font-semibold ${profitCls}`}>{fmt(marginCost)}%</div>
                      </div>
                      <div className="rounded-admin border border-palantir-border bg-palantir-bg p-2">
                        <div className="mono text-[9px] uppercase text-palantir-muted">Margem venda</div>
                        <div className={`mono text-sm font-semibold ${profitCls}`}>{fmt(marginSale)}%</div>
                      </div>
                    </div>
                    {(pixFee != null || cardFee != null || cardAnticipation != null) && (
                      <div className="rounded-admin border border-palantir-red/30 bg-palantir-bg p-2.5">
                        <p className="mono text-[9px] uppercase tracking-wider text-palantir-muted">
                          Estimativa com tarifa vigente do Asaas
                        </p>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          {pixFee != null && (
                            <FeeResult
                              label="Pix"
                              fee={pixFee}
                              netProfit={profit - pixFee}
                            />
                          )}
                          {cardFee != null && (
                            <FeeResult
                              label={`Cartão 1x · D+${cardSettlementDays(
                                asaasFees?.payment?.creditCard
                              )}`}
                              fee={cardFee}
                              netProfit={profit - cardFee}
                            />
                          )}
                          {cardAnticipation != null && (
                            <FeeResult
                              label="Cartão antecipado"
                              fee={cardAnticipation.totalFee}
                              netProfit={profit - cardAnticipation.totalFee}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <Field label="Categoria">
            <div className="space-y-2">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
              >
                <option value="">— Sem categoria —</option>
                {categories
                  .filter((c) => c.is_active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="+ Criar nova categoria"
                  className="flex-1 rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-sm text-white focus-ring-admin"
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
                  className="mono rounded-admin border border-palantir-blue px-3 min-h-touch text-[10px] uppercase text-palantir-blue disabled:opacity-40 focus-ring-admin"
                >
                  Criar
                </button>
              </div>
            </div>
          </Field>
        </div>
      </div>

      {error && <p className="mono mt-3 text-xs text-palantir-red">{error}</p>}

      <div className="mt-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          {editing && (
            <button
              onClick={remove}
              className="mono inline-flex items-center gap-1 min-h-touch text-xs text-palantir-red hover:underline focus-ring-admin"
            >
              <Trash2 className="size-3.5" /> Excluir produto
            </button>
          )}
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <button
            onClick={onClose}
            className="mono text-xs text-palantir-muted min-h-touch px-3 focus-ring-admin"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={loading || uploading}
            className="rounded-admin bg-palantir-blue min-h-touch px-4 text-sm text-white disabled:opacity-40 focus-ring-admin"
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
      setCats((c) => [
        ...c,
        { id: data.id, pdv_id: pdv.id, name: trimmed, sort_order: c.length, is_active: true },
      ]);
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
    <Modal onClose={onClose} title={`Categorias — ${pdv.name}`}>
      <p className="mono text-[11px] text-palantir-muted -mt-1 mb-3">
        {isImageLogo(pdv.logo_url) ? "🖼" : pdv.logo_url} {pdv.slug}
      </p>

      <div className="space-y-1.5 max-h-72 overflow-auto term-scroll">
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
              className="flex-1 bg-transparent text-sm text-white outline-none min-h-touch"
            />
            <button
              onClick={() => update(c.id, { is_active: !c.is_active })}
              className={`mono min-h-touch px-2 text-[9px] uppercase focus-ring-admin ${
                c.is_active
                  ? "bg-palantir-green/15 text-palantir-green"
                  : "bg-palantir-muted/15 text-palantir-muted"
              }`}
            >
              {c.is_active ? "ATIVA" : "INATIVA"}
            </button>
            <button
              onClick={() => remove(c.id)}
              aria-label={`Excluir categoria ${c.name}`}
              className="grid size-touch place-items-center text-palantir-red hover:bg-palantir-red/10 focus-ring-admin"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome da nova categoria"
          className="flex-1 rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-sm text-white focus-ring-admin"
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
          className="rounded-admin bg-palantir-blue px-4 min-h-touch text-sm text-white disabled:opacity-40 focus-ring-admin"
        >
          + Adicionar
        </button>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={onClose}
          className="mono text-xs text-palantir-muted min-h-touch px-3 focus-ring-admin"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
}

// ─── shared ────────────────────────────────────────────────────────

// ─── Delete products dialog (destrutivo) ──────────────────────────

function DeleteProductsDialog({
  products,
  onClose,
  onDeleted,
}: {
  products: ProductRow[];
  onClose: () => void;
  onDeleted: (deletedIds: string[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const many = products.length > 1;

  async function confirmDelete() {
    setError(null);
    setLoading(true);
    const results = await Promise.all(
      products.map((p) =>
        fetch(`/api/admin/products/${p.id}`, { method: "DELETE" })
          .then((r) => ({ id: p.id, ok: r.ok }))
          .catch(() => ({ id: p.id, ok: false }))
      )
    );
    const okIds = results.filter((r) => r.ok).map((r) => r.id);
    const failed = products.length - okIds.length;
    setLoading(false);
    if (failed > 0) {
      setError(`${failed} produto(s) não puderam ser excluídos. Tente de novo.`);
      return;
    }
    onDeleted(okIds);
  }

  return (
    <Modal
      onClose={onClose}
      title={many ? `Excluir ${products.length} produtos` : `Excluir — ${products[0].name}`}
    >
      <div className="rounded-admin border border-palantir-red/40 bg-palantir-red/10 px-3 py-2.5 mb-3">
        <p className="text-[13px] text-palantir-text">
          Esta ação é <span className="font-semibold text-palantir-red">irreversível</span>.
          {many
            ? " Os produtos selecionados serão removidos do cardápio."
            : " O produto será removido do cardápio."}{" "}
          Pedidos antigos não são afetados (guardam nome e preço próprios).
        </p>
      </div>

      {many && (
        <ul className="mb-3 max-h-40 overflow-y-auto rounded-admin border border-palantir-border divide-y divide-palantir-border">
          {products.map((p) => (
            <li key={p.id} className="px-3 py-1.5 text-[13px] text-palantir-text flex justify-between gap-2">
              <span className="truncate">{p.name}</span>
              <span className="mono text-palantir-muted shrink-0">{brl(p.price)}</span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mono text-xs text-palantir-red mb-3">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
        <button
          onClick={onClose}
          className="mono text-xs text-palantir-muted min-h-touch px-3 focus-ring-admin"
        >
          Cancelar
        </button>
        <button
          onClick={confirmDelete}
          disabled={loading}
          className="rounded-admin bg-palantir-red min-h-touch px-4 text-sm font-semibold text-white disabled:opacity-40 focus-ring-admin"
        >
          {loading ? "Excluindo..." : many ? `Excluir ${products.length}` : "Excluir produto"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  children,
  onClose,
  title,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
}) {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-4 lg:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto rounded-t-xl sm:rounded-2xl border border-palantir-border bg-palantir-surface p-4 sm:p-6 lg:p-7 pb-safe ${
          wide ? "sm:max-w-[min(96vw,72rem)]" : "sm:max-w-lg"
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-touch -mr-2 -mt-1 place-items-center text-palantir-muted hover:text-white focus-ring-admin"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Bulk move dialog ─────────────────────────────────────────────

function BulkMoveDialog({
  mode,
  ids,
  products,
  pdvs,
  onClose,
  onDone,
}: {
  mode: "category" | "pdv";
  ids: string[];
  products: ProductRow[];
  pdvs: PdvLite[];
  onClose: () => void;
  onDone: (patch: Partial<ProductRow>) => void;
}) {
  const selectedProducts = products.filter((p) => ids.includes(p.id));
  const distinctPdvIds = Array.from(new Set(selectedProducts.map((p) => p.pdv_id)));
  const samePdv = distinctPdvIds.length === 1;
  const sourcePdvId = distinctPdvIds[0];

  const [targetPdv, setTargetPdv] = useState<string>(sourcePdvId ?? pdvs[0]?.id ?? "");
  const [targetCategory, setTargetCategory] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pra mover categoria: precisa do PDV de origem (mesmo PDV em todos)
  const catPdvId = mode === "category" ? sourcePdvId : targetPdv;

  useEffect(() => {
    if (!catPdvId) return;
    fetch(`/api/admin/categories?pdv_id=${catPdvId}`)
      .then((r) => r.json())
      .then((d) => setCategories(d.items ?? []))
      .catch(() => setCategories([]));
  }, [catPdvId]);

  async function createNewCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed || !catPdvId) return;
    setCreatingCat(true);
    const r = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdv_id: catPdvId, name: trimmed }),
    });
    setCreatingCat(false);
    if (r.ok) {
      const data = await r.json();
      const item: Category = {
        id: data.id,
        pdv_id: catPdvId,
        name: trimmed,
        sort_order: 999,
        is_active: true,
      };
      setCategories((c) => [...c, item]);
      setTargetCategory(data.id);
      setNewCategoryName("");
    }
  }

  async function run() {
    setLoading(true);
    setError(null);
    const apiPatch: Record<string, unknown> = {};
    const optimisticPatch: Partial<ProductRow> = {};
    if (mode === "category") {
      apiPatch.category_id = targetCategory || null;
      optimisticPatch.category_id = targetCategory || null;
      const cat = categories.find((c) => c.id === targetCategory);
      optimisticPatch.category = cat?.name ?? null;
    } else {
      apiPatch.pdv_id = targetPdv;
      apiPatch.category_id = null;
      optimisticPatch.pdv_id = targetPdv;
      optimisticPatch.category_id = null;
      optimisticPatch.category = null;
    }
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/products/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiPatch),
        })
      )
    );
    const failed = results.filter((r) => !r.ok).length;
    setLoading(false);
    if (failed > 0) {
      setError(`${failed} de ${ids.length} falharam`);
      return;
    }
    onDone(optimisticPatch);
  }

  return (
    <Modal
      onClose={onClose}
      title={mode === "category" ? `Adicionar ${ids.length} à categoria` : `Mover ${ids.length} para PDV`}
    >
      {mode === "category" && !samePdv ? (
        <p className="mono text-xs text-palantir-yellow">
          Selecione produtos de um único PDV pra mover de categoria. Sua seleção
          tem produtos de {distinctPdvIds.length} PDVs diferentes.
        </p>
      ) : mode === "category" ? (
        <div className="space-y-3">
          <p className="mono text-[11px] text-palantir-muted">
            PDV: {pdvs.find((p) => p.id === sourcePdvId)?.name ?? "—"}
          </p>
          <Field label="Categoria de destino">
            <select
              value={targetCategory}
              onChange={(e) => setTargetCategory(e.target.value)}
              className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
            >
              <option value="">— Sem categoria —</option>
              {categories
                .filter((c) => c.is_active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>

          <div className="rounded-admin border border-palantir-border bg-palantir-bg p-2 space-y-2">
            <div className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
              Ou criar uma nova categoria
            </div>
            <div className="flex gap-2">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ex.: Promoções, Combos…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createNewCategory();
                  }
                }}
                className="flex-1 rounded-admin border border-palantir-border bg-palantir-surface px-3 min-h-touch text-sm text-white focus-ring-admin"
              />
              <button
                onClick={createNewCategory}
                disabled={!newCategoryName.trim() || creatingCat}
                className="mono rounded-admin border border-palantir-blue px-3 min-h-touch text-[10px] uppercase text-palantir-blue disabled:opacity-40 focus-ring-admin"
              >
                {creatingCat ? "..." : "Criar"}
              </button>
            </div>
            <p className="mono text-[9px] text-palantir-muted">
              A categoria criada será pré-selecionada acima.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="PDV de destino">
            <select
              value={targetPdv}
              onChange={(e) => setTargetPdv(e.target.value)}
              className="w-full rounded-admin border border-palantir-border bg-palantir-bg px-3 min-h-touch text-white focus-ring-admin"
            >
              {pdvs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <p className="mono text-[10px] text-palantir-muted">
            A categoria atual será removida (categorias são por PDV).
          </p>
        </div>
      )}

      {error && <p className="mono mt-3 text-xs text-palantir-red">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="mono text-xs text-palantir-muted min-h-touch px-3 focus-ring-admin"
        >
          Cancelar
        </button>
        <button
          onClick={run}
          disabled={loading || (mode === "category" && !samePdv)}
          className="rounded-admin bg-palantir-blue min-h-touch px-4 text-sm text-white disabled:opacity-40 focus-ring-admin"
        >
          {loading ? "Aplicando..." : mode === "category" ? `Adicionar à categoria` : `Mover ${ids.length}`}
        </button>
      </div>
    </Modal>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "muted" | "blue" | "green" | "red";
}) {
  const toneCls = {
    default: "text-palantir-text",
    muted: "text-palantir-muted",
    blue: "text-palantir-blue",
    green: "text-palantir-green",
    red: "text-palantir-red",
  }[tone];
  return (
    <div className="rounded-admin border border-palantir-border bg-palantir-surface p-3">
      <div className="mono text-[9px] uppercase tracking-wider text-palantir-muted truncate">
        {label}
      </div>
      <div className={`mono mt-1 text-base sm:text-lg font-semibold ${toneCls} truncate`}>
        {value}
      </div>
      {sub && (
        <div className="mono text-[9px] text-palantir-muted truncate mt-0.5">{sub}</div>
      )}
    </div>
  );
}

function PaymentFeeSimulator({
  value,
  fees,
}: {
  value: number;
  fees: AsaasAccountFees | null;
}) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return (
      <div className="rounded-2xl border border-palantir-border/80 bg-gradient-to-br from-palantir-surface to-palantir-bg p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-palantir-blue/15 text-palantir-blue">
            <Sparkles className="size-4" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Simulador Asaas</p>
            <p className="mt-1 text-xs leading-relaxed text-palantir-muted">
              Informe o preço do produto para comparar quanto entra no Pix e no
              cartão antecipado.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const pixFee = estimatePixFee(amount, fees?.payment?.pix);
  const cardFee = estimateCardFee(amount, fees?.payment?.creditCard);
  const anticipated = estimateCardAnticipation(
    amount,
    fees?.payment?.creditCard,
    fees?.anticipation?.creditCard
  );
  const pixFreeRemaining = Math.max(
    0,
    Number(fees?.payment?.pix?.monthlyCreditsWithoutFee ?? 0) -
      Number(fees?.payment?.pix?.creditsReceivedOfCurrentMonth ?? 0)
  );
  const days = cardSettlementDays(fees?.payment?.creditCard);
  const pixNet = pixFee == null ? null : Math.max(0, amount - pixFee);
  const cardNet = cardFee == null ? null : Math.max(0, amount - cardFee);
  const suggestedCardPriceRaw =
    pixNet == null
      ? null
      : priceForAnticipatedCardNet(
          pixNet,
          fees?.payment?.creditCard,
          fees?.anticipation?.creditCard
        );
  const suggestedCardPrice =
    suggestedCardPriceRaw == null
      ? null
      : ceilToCharmPrice(suggestedCardPriceRaw);
  const suggestedDelta =
    suggestedCardPrice == null
      ? 0
      : Math.max(0, suggestedCardPrice - amount);

  return (
    <section
      aria-label="Simulador de taxas do Asaas"
      className="overflow-hidden rounded-2xl border border-palantir-border/80 bg-gradient-to-br from-[#12161e] via-palantir-surface to-palantir-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-palantir-border/70 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-palantir-blue/15 text-palantir-blue ring-1 ring-palantir-blue/20">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-white">
              Quanto você recebe
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-palantir-muted">
              Comparação com as tarifas atuais do Asaas. Só serve de referência —
              o preço do produto não muda sozinho.
            </p>
          </div>
        </div>
        <div className="rounded-full border border-palantir-blue/25 bg-palantir-blue/10 px-3 py-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-palantir-blue/80">
            Preço atual
          </p>
          <p className="num text-sm font-semibold text-white">{brl(amount)}</p>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {fees ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {pixFee != null && pixNet != null && (
                <PaymentEstimate
                  icon={<Zap className="size-4" aria-hidden />}
                  label="Pix"
                  availability="Cai em instantes"
                  badge={
                    pixFreeRemaining > 0
                      ? `${Math.floor(pixFreeRemaining)} grátis no mês`
                      : undefined
                  }
                  fee={pixFee}
                  net={pixNet}
                  tone="blue"
                />
              )}
              {cardFee != null && cardNet != null && (
                <PaymentEstimate
                  icon={<Clock3 className="size-4" aria-hidden />}
                  label="Cartão 1x"
                  availability={`Disponível em ${days} dias`}
                  fee={cardFee}
                  net={cardNet}
                  tone="neutral"
                />
              )}
              {anticipated != null && (
                <PaymentEstimate
                  icon={<CreditCard className="size-4" aria-hidden />}
                  label="Cartão antecipado"
                  availability={`${anticipated.monthlyRate.toLocaleString(
                    "pt-BR"
                  )}% a.m. · ${anticipated.days} dias`}
                  fee={anticipated.totalFee}
                  feeDetail={`${brl(anticipated.processingFee)} cartão + ${brl(
                    anticipated.anticipationFee
                  )} antecipação`}
                  net={anticipated.net}
                  tone="amber"
                  recommended
                />
              )}
            </div>

            {suggestedCardPrice != null && pixNet != null && (
              <div className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent p-4">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-amber-400/10 blur-2xl"
                />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
                      <ArrowUpRight className="size-3.5" aria-hidden />
                      Sugestão de preço
                    </div>
                    <p className="mt-2 text-sm font-medium text-white">
                      Cobrar {brl(suggestedCardPrice)} no cartão antecipado
                    </p>
                    <p className="mt-1 max-w-md text-xs leading-relaxed text-palantir-muted">
                      Mantém o mesmo líquido do Pix ({brl(pixNet)}). Acréscimo
                      estimado de {brl(suggestedDelta)}.
                    </p>
                  </div>
                  <div className="shrink-0 rounded-xl border border-amber-400/20 bg-black/20 px-4 py-3 sm:text-right">
                    <p className="text-[11px] text-amber-200/80">Preço sugerido</p>
                    <p className="num mt-0.5 text-2xl font-semibold tracking-tight text-amber-100">
                      {brl(suggestedCardPrice)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-xs leading-relaxed text-palantir-muted">
              <Info className="mt-0.5 size-3.5 shrink-0 text-palantir-muted" aria-hidden />
              <p>
                A antecipação depende de aprovação do Asaas. O valor definitivo
                aparece na simulação da cobrança.
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-palantir-yellow/25 bg-palantir-yellow/5 px-3 py-3 text-xs text-palantir-yellow">
            Não foi possível consultar as tarifas da conta Asaas agora.
          </div>
        )}
      </div>
    </section>
  );
}

function PaymentEstimate({
  icon,
  label,
  availability,
  badge,
  fee,
  feeDetail,
  net,
  tone = "neutral",
  recommended = false,
}: {
  icon: React.ReactNode;
  label: string;
  availability: string;
  badge?: string;
  fee: number;
  feeDetail?: string;
  net: number;
  tone?: "blue" | "neutral" | "amber";
  recommended?: boolean;
}) {
  const toneStyles = {
    blue: {
      shell: "border-palantir-blue/25 bg-palantir-blue/[0.06]",
      icon: "bg-palantir-blue/15 text-palantir-blue",
      label: "text-palantir-blue",
    },
    neutral: {
      shell: "border-palantir-border bg-palantir-bg/80",
      icon: "bg-white/5 text-palantir-text",
      label: "text-palantir-text",
    },
    amber: {
      shell: "border-amber-400/30 bg-amber-400/[0.07] ring-1 ring-amber-400/10",
      icon: "bg-amber-400/15 text-amber-200",
      label: "text-amber-100",
    },
  }[tone];

  return (
    <article
      className={`relative flex h-full min-w-0 flex-col rounded-2xl border p-4 sm:p-5 transition-colors ${toneStyles.shell}`}
    >
      {recommended && (
        <span className="absolute right-3 top-3 rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-medium leading-none text-amber-200">
          Ideal p/ repasse
        </span>
      )}
      <div className="flex items-start gap-3 pr-20">
        <div
          className={`grid size-9 shrink-0 place-items-center rounded-lg ${toneStyles.icon}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className={`text-[15px] font-medium leading-snug ${toneStyles.label}`}>
            {label}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-palantir-muted">
            {availability}
          </p>
        </div>
      </div>

      {badge && (
        <p className="mt-3 inline-flex w-fit rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-palantir-muted">
          {badge}
        </p>
      )}

      <div className="mt-auto space-y-3.5 pt-5">
        <div>
          <p className="text-xs text-palantir-muted">Você recebe</p>
          <p className="num mt-1.5 text-2xl font-semibold tracking-tight text-palantir-green">
            {brl(net)}
          </p>
        </div>
        <div className="border-t border-white/5 pt-3.5">
          <p className="text-xs text-palantir-muted">Taxas</p>
          <p className="num mt-1 text-sm font-medium text-palantir-red">
            − {brl(fee)}
          </p>
          {feeDetail && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-palantir-muted">
              {feeDetail}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function FeeResult({
  label,
  fee,
  netProfit,
}: {
  label: string;
  fee: number;
  netProfit: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-admin border border-palantir-border px-2.5 py-2">
      <div>
        <p className="mono text-[9px] uppercase text-palantir-muted">{label}</p>
        <p className="mono text-xs text-palantir-red">− {brl(fee)}</p>
      </div>
      <div className="text-right">
        <p className="mono text-[9px] uppercase text-palantir-muted">
          Lucro após Asaas
        </p>
        <p
          className={`mono text-sm font-semibold ${
            netProfit < 0 ? "text-palantir-red" : "text-palantir-green"
          }`}
        >
          {brl(netProfit)}
        </p>
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
