import { describe, expect, it } from "vitest";
import {
  estimateCardAnticipation,
  estimateCardFee,
  estimatePixFee,
  priceForAnticipatedCardNet,
  type AccountCardAnticipationFee,
  type AccountCardFee,
} from "@/lib/asaas-fees";

const cardFee: AccountCardFee = {
  operationValue: 0.49,
  oneInstallmentPercentage: 2.99,
  daysToReceive: 32,
};

const anticipationFee: AccountCardAnticipationFee = {
  detachedMonthlyFeeValue: 1.25,
  installmentMonthlyFeeValue: 1.7,
};

describe("Asaas fee estimates", () => {
  it("aplica a tarifa fixa vigente do Pix", () => {
    expect(
      estimatePixFee(100, {
        fixedFeeValue: 1.99,
        monthlyCreditsWithoutFee: 0,
        creditsReceivedOfCurrentMonth: 0,
      })
    ).toBe(1.99);
  });

  it("calcula processamento e antecipação do cartão à vista", () => {
    expect(estimateCardFee(100, cardFee)).toBe(3.48);
    expect(
      estimateCardAnticipation(100, cardFee, anticipationFee)
    ).toEqual({
      processingFee: 3.48,
      anticipationFee: 1.29,
      totalFee: 4.77,
      net: 95.23,
      monthlyRate: 1.25,
      days: 32,
    });
  });

  it("encontra o menor preço que preserva o líquido desejado", () => {
    const targetNet = 99.01;
    const price = priceForAnticipatedCardNet(
      targetNet,
      cardFee,
      anticipationFee
    );

    expect(price).not.toBeNull();
    const estimate = estimateCardAnticipation(
      price!,
      cardFee,
      anticipationFee
    );
    const previous = estimateCardAnticipation(
      price! - 0.01,
      cardFee,
      anticipationFee
    );
    expect(estimate!.net).toBeGreaterThanOrEqual(targetNet);
    expect(previous!.net).toBeLessThan(targetNet);
  });
});
