import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product } from "@/types";
import {
  findSize,
  listingPrice,
  parseProductSizes,
} from "@/lib/product-sizes";

function cartKey(productId: string, sizeLabel?: string | null) {
  return `${productId}::${sizeLabel?.trim() || ""}`;
}

function itemKey(item: CartItem) {
  return cartKey(item.product.id, item.sizeLabel);
}

function unitPrice(item: CartItem): number {
  const sizes = parseProductSizes(item.product.sizes);
  if (sizes.length > 0) {
    const match = findSize(sizes, item.sizeLabel) ?? sizes[0];
    return match.price;
  }
  return listingPrice(item.product);
}

export interface CartReconcileResult {
  removedItems: number;
  pricesChanged: boolean;
  paymentModeChanged: boolean;
}

interface CartState {
  pdvId: string | null;
  /** Pedido no app · pagamento na tenda/balcão (sem Asaas). */
  payAtCounter: boolean;
  items: CartItem[];
  hasHydrated: boolean;
  add: (
    product: Product,
    opts?: { payAtCounter?: boolean; sizeLabel?: string }
  ) => void;
  remove: (productId: string, sizeLabel?: string) => void;
  setNotes: (productId: string, notes: string, sizeLabel?: string) => void;
  reconcile: (
    products: Product[],
    context: { pdvId: string; payAtCounter: boolean }
  ) => CartReconcileResult;
  setHasHydrated: (value: boolean) => void;
  clear: () => void;
  count: () => number;
  total: () => number;
  qtyOf: (productId: string, sizeLabel?: string) => number;
}

interface PersistedCartItem {
  productId: string;
  qty: number;
  notes?: string;
  sizeLabel?: string;
  unitPrice: number;
}

interface PersistedCartState {
  pdvId: string | null;
  payAtCounter: boolean;
  items: PersistedCartItem[];
}

function placeholderProduct(item: PersistedCartItem, pdvId: string): Product {
  return {
    id: item.productId,
    pdv_id: pdvId,
    category: "",
    name: "Item salvo",
    description: "",
    image_url: "",
    price: item.unitPrice,
    sale_price: null,
    sizes: item.sizeLabel
      ? [{ label: item.sizeLabel, price: item.unitPrice }]
      : null,
    status: "active",
  };
}

function legacyUnitPrice(product: Record<string, unknown>, sizeLabel?: string): number {
  const sizes = parseProductSizes(product.sizes);
  if (sizes.length > 0) {
    return findSize(sizes, sizeLabel)?.price ?? sizes[0].price;
  }
  const sale = Number(product.sale_price);
  if (Number.isFinite(sale) && sale > 0) return sale;
  const price = Number(product.price);
  return Number.isFinite(price) && price >= 0 ? price : 0;
}

function migratePersistedCart(persisted: unknown, version: number): PersistedCartState {
  const value =
    persisted && typeof persisted === "object"
      ? (persisted as Record<string, unknown>)
      : {};
  const pdvId = typeof value.pdvId === "string" ? value.pdvId : null;
  const payAtCounter = value.payAtCounter === true;
  const rawItems = Array.isArray(value.items) ? value.items : [];

  const items = rawItems.flatMap((raw): PersistedCartItem[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const qty = Math.max(1, Math.min(99, Math.floor(Number(item.qty) || 1)));
    const notes = typeof item.notes === "string" ? item.notes : undefined;
    const sizeLabel =
      typeof item.sizeLabel === "string" && item.sizeLabel.trim()
        ? item.sizeLabel.trim()
        : undefined;

    if (version >= 2) {
      if (typeof item.productId !== "string") return [];
      const storedPrice = Number(item.unitPrice);
      return [
        {
          productId: item.productId,
          qty,
          notes,
          sizeLabel,
          unitPrice: Number.isFinite(storedPrice) ? storedPrice : 0,
        },
      ];
    }

    if (!item.product || typeof item.product !== "object") return [];
    const product = item.product as Record<string, unknown>;
    if (typeof product.id !== "string") return [];
    return [
      {
        productId: product.id,
        qty,
        notes,
        sizeLabel,
        unitPrice: legacyUnitPrice(product, sizeLabel),
      },
    ];
  });

  return { pdvId: items.length ? pdvId : null, payAtCounter, items };
}

export const useCart = create<CartState>()(
  persist<CartState, [], [], PersistedCartState>(
    (set, get) => ({
      pdvId: null,
      payAtCounter: false,
      items: [],
      hasHydrated: false,
      add: (product, opts) =>
        set((state) => {
          const sameContext = state.pdvId === null || state.pdvId === product.pdv_id;
          const items = sameContext ? state.items : [];
          const sizes = parseProductSizes(product.sizes);
          let sizeLabel = opts?.sizeLabel?.trim() || undefined;
          if (sizes.length > 0) {
            if (!sizeLabel || !findSize(sizes, sizeLabel)) {
              sizeLabel = sizes[0].label;
            }
          } else {
            sizeLabel = undefined;
          }
          const key = cartKey(product.id, sizeLabel);
          const existing = items.find((i) => itemKey(i) === key);
          const next = existing
            ? items.map((i) =>
                itemKey(i) === key ? { ...i, qty: i.qty + 1, product } : i
              )
            : [...items, { product, qty: 1, sizeLabel }];
          const payAtCounter = sameContext
            ? (opts?.payAtCounter ?? state.payAtCounter)
            : Boolean(opts?.payAtCounter);
          return { pdvId: product.pdv_id, payAtCounter, items: next };
        }),
      remove: (productId, sizeLabel) =>
        set((state) => {
          const key = cartKey(productId, sizeLabel);
          const items = state.items
            .map((i) =>
              itemKey(i) === key ? { ...i, qty: i.qty - 1 } : i
            )
            .filter((i) => i.qty > 0);
          return {
            items,
            pdvId: items.length ? state.pdvId : null,
            payAtCounter: items.length ? state.payAtCounter : false,
          };
        }),
      setNotes: (productId, notes, sizeLabel) =>
        set((state) => ({
          items: state.items.map((i) =>
            itemKey(i) === cartKey(productId, sizeLabel) ? { ...i, notes } : i
          ),
        })),
      reconcile: (products, context) => {
        const result: CartReconcileResult = {
          removedItems: 0,
          pricesChanged: false,
          paymentModeChanged: false,
        };

        set((state) => {
          if (state.pdvId !== context.pdvId) return state;

          const byId = new Map(products.map((product) => [product.id, product]));
          const items = state.items.flatMap((item): CartItem[] => {
            const product = byId.get(item.product.id);
            if (!product || product.status !== "active") {
              result.removedItems += 1;
              return [];
            }

            const sizes = parseProductSizes(product.sizes);
            let sizeLabel = item.sizeLabel;
            if (sizes.length > 0) {
              const match = findSize(sizes, sizeLabel);
              if (!match) {
                result.removedItems += 1;
                return [];
              }
              sizeLabel = match.label;
            } else {
              sizeLabel = undefined;
            }

            const nextItem: CartItem = { ...item, product, sizeLabel };
            if (Math.abs(unitPrice(nextItem) - unitPrice(item)) >= 0.01) {
              result.pricesChanged = true;
            }
            return [nextItem];
          });

          result.paymentModeChanged = state.payAtCounter !== context.payAtCounter;
          return {
            items,
            pdvId: items.length ? state.pdvId : null,
            payAtCounter: items.length ? context.payAtCounter : false,
          };
        });

        return result;
      },
      setHasHydrated: (value) => set({ hasHydrated: value }),
      clear: () => set({ items: [], pdvId: null, payAtCounter: false }),
      count: () => get().items.reduce((s, i) => s + i.qty, 0),
      total: () =>
        get().items.reduce((s, i) => s + i.qty * unitPrice(i), 0),
      qtyOf: (productId, sizeLabel) => {
        if (sizeLabel !== undefined) {
          return (
            get().items.find(
              (i) => itemKey(i) === cartKey(productId, sizeLabel)
            )?.qty ?? 0
          );
        }
        // Soma de todos os tamanhos desse produto
        return get().items
          .filter((i) => i.product.id === productId)
          .reduce((s, i) => s + i.qty, 0);
      },
    }),
    {
      name: "mafood-cart",
      version: 2,
      partialize: (state) => ({
        pdvId: state.pdvId,
        payAtCounter: state.payAtCounter,
        items: state.items.map((item) => ({
          productId: item.product.id,
          qty: item.qty,
          notes: item.notes,
          sizeLabel: item.sizeLabel,
          unitPrice: unitPrice(item),
        })),
      }),
      migrate: migratePersistedCart,
      merge: (persisted, current) => {
        const stored = migratePersistedCart(persisted, 2);
        const pdvId = stored.pdvId;
        return {
          ...current,
          pdvId,
          payAtCounter: stored.items.length ? stored.payAtCounter : false,
          items:
            pdvId == null
              ? []
              : stored.items.map((item) => ({
                  product: placeholderProduct(item, pdvId),
                  qty: item.qty,
                  notes: item.notes,
                  sizeLabel: item.sizeLabel,
                })),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export { unitPrice as cartItemUnitPrice };
