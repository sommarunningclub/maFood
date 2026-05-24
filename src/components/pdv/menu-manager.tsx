"use client";

import { useState } from "react";
import { brl } from "@/lib/utils";
import type { Product, ProductStatus } from "@/types";

const STATUS_META: Record<ProductStatus, { label: string; cls: string }> = {
  active: { label: "DISPONÍVEL", cls: "text-palantir-green" },
  paused: { label: "PAUSADO", cls: "text-palantir-yellow" },
  out_of_stock: { label: "RUPTURA", cls: "text-palantir-red" },
};

export function MenuManager({
  products,
  onClose,
}: {
  products: Product[];
  onClose: () => void;
}) {
  const [items, setItems] = useState(products);

  function setStatus(id: string, status: ProductStatus) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-admin border border-palantir-border bg-palantir-surface">
        <header className="flex items-center justify-between border-b border-palantir-border px-5 py-3">
          <h2 className="font-semibold text-white">Gerenciar Cardápio</h2>
          <button onClick={onClose} className="text-palantir-muted hover:text-white">
            ✕
          </button>
        </header>
        <div className="term-scroll flex-1 overflow-y-auto p-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="mono text-left text-xs text-palantir-muted">
                <th className="p-2">ITEM</th>
                <th className="p-2">PREÇO</th>
                <th className="p-2">STATUS</th>
                <th className="p-2 text-right">AÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const meta = STATUS_META[p.status];
                return (
                  <tr key={p.id} className="border-t border-palantir-border">
                    <td className="p-2 text-palantir-text">{p.name}</td>
                    <td className="mono p-2 text-palantir-text">{brl(p.price)}</td>
                    <td className={`mono p-2 text-xs ${meta.cls}`}>{meta.label}</td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setStatus(p.id, p.status === "paused" ? "active" : "paused")}
                          className="rounded-admin border border-palantir-border px-2 py-1 text-xs text-palantir-yellow hover:bg-palantir-surface2"
                        >
                          {p.status === "paused" ? "Retomar" : "Pausar"}
                        </button>
                        <button
                          onClick={() => setStatus(p.id, p.status === "out_of_stock" ? "active" : "out_of_stock")}
                          className="rounded-admin border border-palantir-border px-2 py-1 text-xs text-palantir-red hover:bg-palantir-surface2"
                        >
                          {p.status === "out_of_stock" ? "Repor" : "Ruptura"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
