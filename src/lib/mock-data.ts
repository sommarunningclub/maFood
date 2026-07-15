import type { Venue, Pdv, Product, Order, Coupon } from "@/types";

export const VENUE: Venue = {
  id: "v-somma",
  slug: "somma-special-day",
  name: "Somma Special Day",
  description: "",
  logo_url: "",
  is_active: true,
};

export const PDVS: Pdv[] = [
  {
    id: "pdv-smash",
    venue_id: "v-somma",
    slug: "smash-house",
    name: "Smash House",
    category: "Hambúrgueres",
    logo_url: "🍔",
    prep_time_min: 12,
    commission_pct: 15,
    gateway_pct: 3.6,
    is_open: true,
    is_visible: true,
    sells_online: false,
    sort_order: 1,
    wallet_balance: 3712.4,
  },
  {
    id: "pdv-beer",
    venue_id: "v-somma",
    slug: "beer-club",
    name: "Beer Club",
    category: "Bebidas",
    logo_url: "🍺",
    prep_time_min: 4,
    commission_pct: 12,
    gateway_pct: 3.6,
    is_open: true,
    is_visible: true,
    sells_online: true,
    sort_order: 2,
    wallet_balance: 2308.0,
  },
  {
    id: "pdv-acai",
    venue_id: "v-somma",
    slug: "acai-power",
    name: "Açaí Power",
    category: "Saudável",
    logo_url: "🥣",
    prep_time_min: 8,
    commission_pct: 15,
    gateway_pct: 3.6,
    is_open: true,
    is_visible: true,
    sells_online: false,
    sort_order: 3,
    wallet_balance: 1490.5,
  },
  {
    id: "pdv-coffee",
    venue_id: "v-somma",
    slug: "coffee-lab",
    name: "Coffee Lab",
    category: "Café",
    logo_url: "☕",
    prep_time_min: 6,
    commission_pct: 15,
    gateway_pct: 3.6,
    is_open: false,
    is_visible: true,
    sells_online: false,
    sort_order: 4,
    wallet_balance: 498.0,
  },
  {
    id: "pdv-store",
    venue_id: "v-somma",
    slug: "somma-store",
    name: "Somma Store",
    category: "Loja",
    logo_url: "🎽",
    prep_time_min: 2,
    commission_pct: 10,
    gateway_pct: 3.6,
    is_open: true,
    is_visible: true,
    sells_online: false,
    sort_order: 5,
    wallet_balance: 247.9,
  },
];

export const PRODUCTS: Product[] = [
  // Smash House
  { id: "p1", pdv_id: "pdv-smash", category: "Combos", name: "Combo Smash", description: "2 smash burgers + fritas + refri", image_url: "", price: 38, status: "active" },
  { id: "p2", pdv_id: "pdv-smash", category: "Burgers", name: "Smash Duplo", description: "2 carnes, cheddar, picles", image_url: "", price: 28, status: "active" },
  { id: "p3", pdv_id: "pdv-smash", category: "Burgers", name: "Smash Bacon", description: "Carne, bacon crocante, cheddar", image_url: "", price: 26, status: "paused" },
  { id: "p4", pdv_id: "pdv-smash", category: "Acompanhamentos", name: "Fritas Rústicas", description: "Porção generosa", image_url: "", price: 14, status: "active" },
  // Beer Club
  { id: "p5", pdv_id: "pdv-beer", category: "Cervejas", name: "Chopp Pilsen 500ml", description: "Gelado", image_url: "", price: 16, status: "active" },
  { id: "p6", pdv_id: "pdv-beer", category: "Cervejas", name: "IPA Artesanal", description: "Long neck 355ml", image_url: "", price: 22, status: "active" },
  { id: "p7", pdv_id: "pdv-beer", category: "Sem álcool", name: "Refrigerante Lata", description: "Coca, Guaraná, Sprite", image_url: "", price: 8, status: "out_of_stock" },
  // Açaí Power
  { id: "p8", pdv_id: "pdv-acai", category: "Açaí", name: "Açaí 500ml", description: "Com 3 acompanhamentos", image_url: "", price: 24, status: "active" },
  { id: "p9", pdv_id: "pdv-acai", category: "Açaí", name: "Açaí Fitness", description: "Banana, granola, whey", image_url: "", price: 28, status: "active" },
  // Coffee Lab
  { id: "p10", pdv_id: "pdv-coffee", category: "Café", name: "Cappuccino", description: "Espresso + leite vaporizado", image_url: "", price: 12, status: "active" },
  { id: "p11", pdv_id: "pdv-coffee", category: "Café", name: "Cold Brew", description: "12h de extração", image_url: "", price: 15, status: "active" },
  // Somma Store
  { id: "p12", pdv_id: "pdv-store", category: "Vestuário", name: "Camiseta Special Day", description: "Edição comemorativa 1 ano", image_url: "", price: 79, status: "active" },
  { id: "p13", pdv_id: "pdv-store", category: "Acessórios", name: "Garrafa Térmica Somma", description: "750ml inox", image_url: "", price: 89, status: "active" },
];

function mkOrder(
  i: number,
  pdv: Pdv,
  status: Order["status"],
  items: Order["items"],
  minsAgo: number,
  name: string,
  method: Order["method"] = "pix"
): Order {
  const total = items.reduce((s, it) => s + it.unit_price * it.qty, 0);
  const created = new Date(Date.now() - minsAgo * 60_000).toISOString();
  return {
    id: `o-${i}`,
    number: 1000 + i,
    venue_id: "v-somma",
    pdv_id: pdv.id,
    pdv_name: pdv.name,
    customer_name: name,
    items,
    total,
    method,
    status,
    created_at: created,
    paid_at: status !== "pending" ? created : undefined,
  };
}

export const ORDERS: Order[] = [
  mkOrder(42, PDVS[0], "paid", [{ id: "i1", product_id: "p1", name: "Combo Smash", qty: 2, unit_price: 38 }, { id: "i2", product_id: "p4", name: "Fritas Rústicas", qty: 1, unit_price: 14, notes: "Sem sal" }], 2, "Lucas M."),
  mkOrder(43, PDVS[0], "paid", [{ id: "i3", product_id: "p2", name: "Smash Duplo", qty: 1, unit_price: 28, notes: "Sem cebola" }], 5, "Ana P."),
  mkOrder(44, PDVS[0], "preparing", [{ id: "i4", product_id: "p1", name: "Combo Smash", qty: 1, unit_price: 38 }], 9, "Bruno R.", "card"),
  mkOrder(45, PDVS[0], "preparing", [{ id: "i5", product_id: "p2", name: "Smash Duplo", qty: 3, unit_price: 28 }], 12, "Camila S."),
  mkOrder(46, PDVS[0], "ready", [{ id: "i6", product_id: "p4", name: "Fritas Rústicas", qty: 2, unit_price: 14 }], 18, "Diego F."),
  mkOrder(47, PDVS[0], "delivered", [{ id: "i7", product_id: "p1", name: "Combo Smash", qty: 1, unit_price: 38 }], 35, "Elisa T."),
  mkOrder(48, PDVS[1], "paid", [{ id: "i8", product_id: "p5", name: "Chopp Pilsen 500ml", qty: 4, unit_price: 16 }], 3, "Fábio G."),
  mkOrder(49, PDVS[2], "preparing", [{ id: "i9", product_id: "p8", name: "Açaí 500ml", qty: 2, unit_price: 24 }], 7, "Gabi L.", "card"),
  mkOrder(50, PDVS[2], "ready", [{ id: "i10", product_id: "p9", name: "Açaí Fitness", qty: 1, unit_price: 28 }], 15, "Hugo V."),
];

export const COUPONS: Coupon[] = [
  { id: "c1", code: "SOMMA1ANO", type: "percent", value: 10, min_order: 30, max_uses: 200, used: 47, is_active: true, valid_until: "2026-07-18" },
  { id: "c2", code: "PRIMEIRACOMPRA", type: "fixed", value: 5, min_order: 20, max_uses: 400, used: 132, is_active: true, valid_until: "2026-07-18" },
  { id: "c3", code: "RUNNERS", type: "percent", value: 15, min_order: 50, max_uses: 100, used: 100, is_active: false, valid_until: "2026-07-18" },
];

export function getPdvBySlug(slug: string) {
  return PDVS.find((p) => p.slug === slug);
}
export function getProductsByPdv(pdvId: string) {
  return PRODUCTS.filter((p) => p.pdv_id === pdvId);
}
export function getOrderById(id: string) {
  return ORDERS.find((o) => o.id === id || String(o.number) === id);
}
export function getOrdersByPdv(pdvId: string) {
  return ORDERS.filter((o) => o.pdv_id === pdvId);
}

export function validateCoupon(code: string, subtotal: number) {
  const c = COUPONS.find(
    (x) => x.code.toUpperCase() === code.trim().toUpperCase()
  );
  if (!c) return { ok: false as const, error: "Cupom inexistente" };
  if (!c.is_active) return { ok: false as const, error: "Cupom inativo" };
  if (c.used >= c.max_uses)
    return { ok: false as const, error: "Cupom esgotado" };
  if (subtotal < c.min_order)
    return {
      ok: false as const,
      error: `Mínimo ${c.min_order.toFixed(0)} reais`,
    };
  const discount =
    c.type === "percent" ? (subtotal * c.value) / 100 : c.value;
  return { ok: true as const, coupon: c, discount };
}
