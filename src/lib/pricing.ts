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

function isCharmCents(cents: number): boolean {
  const rem = ((cents % 100) + 100) % 100;
  return rem === 0 || rem === 99;
}

/**
 * Preço “de vitrine”: fecha em ,00 ou ,99 (o mais próximo).
 * Em empate, prefere ,99. Valores ≤ 0 permanecem 0.
 */
export function roundToCharmPrice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  const cents = Math.round(value * 100);
  const reais = Math.floor(cents / 100);
  const candidates = [
    reais * 100,
    reais * 100 + 99,
    (reais + 1) * 100,
    reais > 0 ? (reais - 1) * 100 + 99 : null,
  ].filter((c): c is number => c != null && c > 0);

  let best = candidates[0]!;
  let bestDist = Math.abs(best - cents);
  for (const c of candidates) {
    const dist = Math.abs(c - cents);
    if (dist < bestDist || (dist === bestDist && c % 100 === 99)) {
      best = c;
      bestDist = dist;
    }
  }
  return best / 100;
}

/**
 * Sobe até o próximo preço ,00/,99 — útil quando o valor mínimo
 * precisa cobrir taxas/líquido alvo.
 */
export function ceilToCharmPrice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  let cents = Math.max(1, Math.ceil(value * 100 - Number.EPSILON));
  while (!isCharmCents(cents)) cents += 1;
  return cents / 100;
}
