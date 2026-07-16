import type { AsaasAccountFees } from "@/lib/asaas";

export type AccountPixFee = NonNullable<
  NonNullable<AsaasAccountFees["payment"]>["pix"]
>;
export type AccountCardFee = NonNullable<
  NonNullable<AsaasAccountFees["payment"]>["creditCard"]
>;
export type AccountCardAnticipationFee = NonNullable<
  NonNullable<AsaasAccountFees["anticipation"]>["creditCard"]
>;

export interface CardAnticipationEstimate {
  processingFee: number;
  anticipationFee: number;
  totalFee: number;
  net: number;
  monthlyRate: number;
  days: number;
}

function feeDiscountActive(expires: string | null | undefined) {
  if (!expires) return false;
  const time = new Date(expires.replace(" ", "T")).getTime();
  return Number.isFinite(time) && time > Date.now();
}

export function roundMoney(value: number) {
  return Math.max(0, Math.round((value + Number.EPSILON) * 100) / 100);
}

function effectiveCardPercentage(fee: AccountCardFee) {
  const value =
    fee.discountOneInstallmentPercentage != null &&
    feeDiscountActive(fee.discountExpiration)
      ? Number(fee.discountOneInstallmentPercentage)
      : Number(fee.oneInstallmentPercentage ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function estimatePixFee(
  value: number,
  fee: AccountPixFee | undefined
) {
  if (!fee) return null;
  const freeRemaining =
    Number(fee.monthlyCreditsWithoutFee ?? 0) -
    Number(fee.creditsReceivedOfCurrentMonth ?? 0);
  if (freeRemaining > 0) return 0;
  if (
    fee.fixedFeeValueWithDiscount != null &&
    feeDiscountActive(fee.discountExpiration)
  ) {
    return roundMoney(Number(fee.fixedFeeValueWithDiscount));
  }
  if (fee.fixedFeeValue != null) {
    return roundMoney(Number(fee.fixedFeeValue));
  }
  if (fee.percentageFee == null) return null;

  let result = (value * Number(fee.percentageFee)) / 100;
  if (fee.minimumFeeValue != null) {
    result = Math.max(result, Number(fee.minimumFeeValue));
  }
  if (fee.maximumFeeValue != null) {
    result = Math.min(result, Number(fee.maximumFeeValue));
  }
  return roundMoney(result);
}

export function estimateCardFee(
  value: number,
  fee: AccountCardFee | undefined
) {
  if (!fee) return null;
  const percentage = effectiveCardPercentage(fee);
  return roundMoney(
    (value * percentage) / 100 + Number(fee.operationValue ?? 0)
  );
}

export function cardSettlementDays(fee: AccountCardFee | undefined) {
  const value = Number(fee?.daysToReceive ?? 32);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 32;
}

/**
 * Estimativa informativa. O Asaas calcula o valor definitivo na simulação da
 * cobrança, considerando a data real da solicitação e a análise da conta.
 */
export function estimateCardAnticipation(
  value: number,
  paymentFee: AccountCardFee | undefined,
  anticipationFee: AccountCardAnticipationFee | undefined
): CardAnticipationEstimate | null {
  const processingFee = estimateCardFee(value, paymentFee);
  const monthlyRate = Number(anticipationFee?.detachedMonthlyFeeValue);
  if (
    processingFee == null ||
    anticipationFee?.detachedMonthlyFeeValue == null ||
    !Number.isFinite(monthlyRate) ||
    monthlyRate < 0
  ) {
    return null;
  }

  const days = cardSettlementDays(paymentFee);
  const receivable = Math.max(0, value - processingFee);
  const anticipationValue = roundMoney(
    receivable * (monthlyRate / 100) * (days / 30)
  );
  const totalFee = roundMoney(processingFee + anticipationValue);

  return {
    processingFee,
    anticipationFee: anticipationValue,
    totalFee,
    net: roundMoney(value - totalFee),
    monthlyRate,
    days,
  };
}

/** Menor preço em centavos que preserva o líquido desejado após antecipação. */
export function priceForAnticipatedCardNet(
  targetNet: number,
  paymentFee: AccountCardFee | undefined,
  anticipationFee: AccountCardAnticipationFee | undefined
) {
  if (!paymentFee || !anticipationFee || targetNet <= 0) return null;

  const percentage = effectiveCardPercentage(paymentFee) / 100;
  const monthlyRate = Number(anticipationFee.detachedMonthlyFeeValue);
  const days = cardSettlementDays(paymentFee);
  const anticipationFactor = (monthlyRate / 100) * (days / 30);
  if (
    !Number.isFinite(monthlyRate) ||
    monthlyRate < 0 ||
    percentage >= 1 ||
    anticipationFactor >= 1
  ) {
    return null;
  }

  const fixed = Math.max(0, Number(paymentFee.operationValue ?? 0));
  const target = roundMoney(targetNet);
  const raw = (target / (1 - anticipationFactor) + fixed) / (1 - percentage);
  let candidateCents = Math.max(1, Math.ceil((raw - Number.EPSILON) * 100));

  for (let attempts = 0; attempts < 1_000; attempts += 1) {
    const estimate = estimateCardAnticipation(
      candidateCents / 100,
      paymentFee,
      anticipationFee
    );
    if (!estimate || estimate.net >= target) break;
    candidateCents += 1;
  }

  for (let attempts = 0; attempts < 1_000 && candidateCents > 1; attempts += 1) {
    const previous = estimateCardAnticipation(
      (candidateCents - 1) / 100,
      paymentFee,
      anticipationFee
    );
    if (!previous || previous.net < target) break;
    candidateCents -= 1;
  }

  return candidateCents / 100;
}
