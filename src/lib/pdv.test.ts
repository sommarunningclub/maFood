import { describe, it, expect } from "vitest";
import { pdvSellsOnline } from "./pdv";

describe("pdvSellsOnline", () => {
  it("is true for Bebidas (case/space insensitive)", () => {
    expect(pdvSellsOnline({ category: "Bebidas" })).toBe(true);
    expect(pdvSellsOnline({ category: " bebidas " })).toBe(true);
    expect(pdvSellsOnline({ category: "BEBIDAS" })).toBe(true);
  });
  it("is false for food and empty categories", () => {
    expect(pdvSellsOnline({ category: "Hamburgueria" })).toBe(false);
    expect(pdvSellsOnline({ category: "" })).toBe(false);
    expect(pdvSellsOnline({ category: null })).toBe(false);
    expect(pdvSellsOnline({})).toBe(false);
  });
});
