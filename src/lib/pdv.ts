/**
 * A PDV sells and charges inside maFood (Asaas flow) only when it is a
 * beverages PDV. Single source of truth for the payment-routing rule —
 * change here if the rule evolves (e.g. an admin toggle).
 */
export function pdvSellsOnline(pdv: { category?: string | null }): boolean {
  return (pdv.category ?? "").trim().toLowerCase() === "bebidas";
}
