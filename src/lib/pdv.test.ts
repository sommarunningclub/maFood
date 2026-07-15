import { describe, it, expect } from "vitest";
import { pdvSellsOnline } from "./pdv";

describe("pdvSellsOnline", () => {
  it("prefers sells_online flag when set", () => {
    expect(pdvSellsOnline({ sells_online: true, category: "Crepe" })).toBe(true);
    expect(pdvSellsOnline({ sells_online: false, category: "Bebidas" })).toBe(false);
  });

  it("falls back to Bebidas category when flag absent", () => {
    expect(pdvSellsOnline({ category: "Bebidas" })).toBe(true);
    expect(pdvSellsOnline({ category: " bebidas " })).toBe(true);
    expect(pdvSellsOnline({ category: "BEBIDAS" })).toBe(true);
  });

  it("is false for food and empty categories without flag", () => {
    expect(pdvSellsOnline({ category: "Hamburgueria" })).toBe(false);
    expect(pdvSellsOnline({ category: "Crepe" })).toBe(false);
    expect(pdvSellsOnline({ category: "" })).toBe(false);
    expect(pdvSellsOnline({ category: null })).toBe(false);
    expect(pdvSellsOnline({})).toBe(false);
  });
});
