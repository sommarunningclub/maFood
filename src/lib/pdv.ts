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
