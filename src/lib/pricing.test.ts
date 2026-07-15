import { describe, it, expect } from "vitest";
import { effectivePrice } from "./pricing";

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
