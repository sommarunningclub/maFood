/**
 * PDV aceita pedido e pagamento pelo app (Asaas).
 * Fonte da verdade: coluna `sells_online`. Fallback legado: categoria "bebidas".
 */
export function pdvSellsOnline(pdv: {
  sells_online?: boolean | null;
  category?: string | null;
}): boolean {
  if (typeof pdv.sells_online === "boolean") return pdv.sells_online;
  return (pdv.category ?? "").trim().toLowerCase() === "bebidas";
}

/** Somma Bar — GIFs de marca (bebendo) só neste PDV. */
export function isSommaBar(pdv: {
  slug?: string | null;
  name?: string | null;
}): boolean {
  const slug = (pdv.slug ?? "").trim().toLowerCase();
  if (slug === "somma-bear" || slug === "somma-bar") return true;
  return (pdv.name ?? "").trim().toLowerCase() === "somma bar";
}
