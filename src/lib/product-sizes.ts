export type ProductSize = {
  label: string;
  price: number;
  note?: string;
};

export function parseProductSizes(raw: unknown): ProductSize[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: ProductSize[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    const price = Number(o.price);
    if (!label || !Number.isFinite(price) || price < 0) continue;
    const note = typeof o.note === "string" && o.note.trim() ? o.note.trim() : undefined;
    out.push({ label, price, note });
  }
  return out;
}

export function productHasSizes(p: { sizes?: unknown }): boolean {
  return parseProductSizes(p.sizes).length > 0;
}

/** Preço de listagem: menor tamanho, ou preço base. */
export function listingPrice(p: {
  price: number | string | null;
  sale_price?: number | string | null;
  sizes?: unknown;
}): number {
  const sizes = parseProductSizes(p.sizes);
  if (sizes.length > 0) return Math.min(...sizes.map((s) => s.price));
  const sale = p.sale_price;
  if (sale != null && Number(sale) > 0) return Number(sale);
  return Number(p.price ?? 0);
}

export function findSize(
  sizes: ProductSize[],
  label: string | null | undefined
): ProductSize | null {
  if (!label) return null;
  const needle = label.trim().toLowerCase();
  return sizes.find((s) => s.label.trim().toLowerCase() === needle) ?? null;
}

export function lineDisplayName(baseName: string, sizeLabel?: string | null): string {
  if (!sizeLabel?.trim()) return baseName;
  return `${baseName} · ${sizeLabel.trim()}`;
}
