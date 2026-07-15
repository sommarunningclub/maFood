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

interface CartState {
  pdvId: string | null;
  /** Pedido no app · pagamento na tenda/balcão (sem Asaas). */
  payAtCounter: boolean;
  items: CartItem[];
  add: (
    product: Product,
    opts?: { payAtCounter?: boolean; sizeLabel?: string }
  ) => void;
  remove: (productId: string, sizeLabel?: string) => void;
  setNotes: (productId: string, notes: string, sizeLabel?: string) => void;
  clear: () => void;
  count: () => number;
  total: () => number;
  qtyOf: (productId: string, sizeLabel?: string) => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      pdvId: null,
      payAtCounter: false,
      items: [],
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
    { name: "mafood-cart" }
  )
);

export { unitPrice as cartItemUnitPrice };
