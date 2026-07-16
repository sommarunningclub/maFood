import { describe, it, expect } from "vitest";
import {
  ceilToCharmPrice,
  effectivePrice,
  roundToCharmPrice,
} from "./pricing";

describe("effectivePrice", () => {
  it("usa sale_price quando preenchido e > 0", () => {
    expect(effectivePrice({ price: 5, sale_price: 8 })).toBe(8);
    expect(effectivePrice({ price: 10, sale_price: "12.5" })).toBe(12.5);
  });

  it("cai para price quando sale_price é null/0/ausente", () => {
    expect(effectivePrice({ price: 5, sale_price: null })).toBe(5);
    expect(effectivePrice({ price: 5, sale_price: 0 })).toBe(5);
    expect(effectivePrice({ price: 7 })).toBe(7);
    expect(effectivePrice({ price: "9.9", sale_price: null })).toBe(9.9);
  });
});

describe("roundToCharmPrice", () => {
  it("mantém preços já em ,00 ou ,99", () => {
    expect(roundToCharmPrice(10)).toBe(10);
    expect(roundToCharmPrice(9.99)).toBe(9.99);
    expect(roundToCharmPrice(40)).toBe(40);
  });

  it("escolhe o ,00/,99 mais próximo", () => {
    expect(roundToCharmPrice(37.9)).toBe(37.99);
    expect(roundToCharmPrice(40.1)).toBe(40);
    expect(roundToCharmPrice(40.5)).toBe(40.99);
    expect(roundToCharmPrice(40.6)).toBe(40.99);
    expect(roundToCharmPrice(39.4)).toBe(39);
    expect(roundToCharmPrice(39.7)).toBe(39.99);
  });

  it("zera valores inválidos", () => {
    expect(roundToCharmPrice(0)).toBe(0);
    expect(roundToCharmPrice(-1)).toBe(0);
  });
});

describe("ceilToCharmPrice", () => {
  it("sobe até cobrir o mínimo", () => {
    expect(ceilToCharmPrice(40.1)).toBe(40.99);
    expect(ceilToCharmPrice(40)).toBe(40);
    expect(ceilToCharmPrice(39.99)).toBe(39.99);
    expect(ceilToCharmPrice(39.991)).toBe(40);
  });
});
