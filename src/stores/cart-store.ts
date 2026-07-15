import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product } from "@/types";

interface CartState {
  pdvId: string | null;
  /** Pedido no app · pagamento na tenda/balcão (sem Asaas). */
  payAtCounter: boolean;
  items: CartItem[];
  add: (product: Product, opts?: { payAtCounter?: boolean }) => void;
  remove: (productId: string) => void;
  setNotes: (productId: string, notes: string) => void;
  clear: () => void;
  count: () => number;
  total: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      pdvId: null,
      payAtCounter: false,
      items: [],
      add: (product, opts) =>
        set((state) => {
          // Carrinho é por PDV — trocar de PDV limpa o carrinho
          const sameContext = state.pdvId === null || state.pdvId === product.pdv_id;
          const items = sameContext ? state.items : [];
          const existing = items.find((i) => i.product.id === product.id);
          const next = existing
            ? items.map((i) =>
                i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
              )
            : [...items, { product, qty: 1 }];
          const payAtCounter = sameContext
            ? (opts?.payAtCounter ?? state.payAtCounter)
            : Boolean(opts?.payAtCounter);
          return { pdvId: product.pdv_id, payAtCounter, items: next };
        }),
      remove: (productId) =>
        set((state) => {
          const items = state.items
            .map((i) =>
              i.product.id === productId ? { ...i, qty: i.qty - 1 } : i
            )
            .filter((i) => i.qty > 0);
          return {
            items,
            pdvId: items.length ? state.pdvId : null,
            payAtCounter: items.length ? state.payAtCounter : false,
          };
        }),
      setNotes: (productId, notes) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.product.id === productId ? { ...i, notes } : i
          ),
        })),
      clear: () => set({ items: [], pdvId: null, payAtCounter: false }),
      count: () => get().items.reduce((s, i) => s + i.qty, 0),
      total: () => get().items.reduce((s, i) => s + i.qty * i.product.price, 0),
    }),
    { name: "mafood-cart" }
  )
);
