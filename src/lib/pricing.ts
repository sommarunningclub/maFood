import type { PriceBreakdown } from "@/types";

/**
 * Preço efetivo mostrado/cobrado ao cliente.
 * Regra: se houver `sale_price` (override de venda, ex.: Somma Bear) preenchido
 * e positivo, ele prevalece; caso contrário usa `price`.
 */
export function effectivePrice(p: {
  price: number | string | null;
  sale_price?: number | string | null;
}): number {
  const sale = p.sale_price;
  if (sale != null && Number(sale) > 0) return Number(sale);
  return Number(p.price ?? 0);
}

interface Rates {
  commissionPct: number; // ex.: 15 = 15%
  gatewayPct: number; // ex.: 3.6
  taxPct?: number; // ex.: 0
}

/**
 * Engine de precificação — sempre calculado, nunca armazenado.
 * Recebe o preço final e devolve o breakdown completo.
 */
export function breakdownFromFinal(final: number, rates: Rates): PriceBreakdown {
  const { commissionPct, gatewayPct, taxPct = 0 } = rates;
  const commission = (final * commissionPct) / 100;
  const gateway = (final * gatewayPct) / 100;
  const tax = (final * taxPct) / 100;
  const net = final - commission - gateway - tax;
  return { final, commission, gateway, tax, net };
}

/** Dado o líquido desejado, calcula o preço final necessário. */
export function finalFromNet(net: number, rates: Rates): number {
  const { commissionPct, gatewayPct, taxPct = 0 } = rates;
  const divisor = 1 - (commissionPct + gatewayPct + taxPct) / 100;
  return net / divisor;
}

/** Dado o líquido desejado, calcula o preço final a partir da margem (%). */
export function finalFromMargin(cost: number, marginPct: number, rates: Rates): number {
  const net = cost * (1 + marginPct / 100);
  return finalFromNet(net, rates);
}
