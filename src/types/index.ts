// ── Domain types (mirror Supabase schema) ──────────────────────────

export type OrderStatus =
  | "pending" // aguardando pagamento
  | "paid" // pago, na fila do PDV (NOVOS)
  | "preparing" // em preparo
  | "ready" // pronto p/ retirada
  | "partial" // retirada parcial — alguns itens já entregues
  | "delivered" // entregue
  | "cancelled";

export type PaymentMethod = "pix" | "card";

export type ProductStatus = "active" | "paused" | "out_of_stock";

export interface Venue {
  id: string;
  slug: string;
  name: string;
  description: string;
  logo_url: string;
  is_active: boolean;
}

export interface Pdv {
  id: string;
  venue_id: string;
  slug: string;
  name: string;
  category: string;
  logo_url: string;
  prep_time_min: number;
  commission_pct: number;
  gateway_pct: number;
  is_open: boolean;
  sort_order: number;
  wallet_balance: number;
}

export interface Product {
  id: string;
  pdv_id: string;
  category: string;
  name: string;
  description: string;
  image_url: string;
  price: number; // preço base ao cliente
  sale_price?: number | null; // override de venda (Somma Bear); quando definido, prevalece sobre price
  status: ProductStatus;
}

export interface OrderItem {
  id: string;
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  notes?: string;
}

export interface Order {
  id: string;
  number: number;
  venue_id: string;
  pdv_id: string;
  pdv_name: string;
  customer_name: string;
  customer_cpf?: string;
  items: OrderItem[];
  total: number;
  method: PaymentMethod;
  status: OrderStatus;
  notes?: string;
  created_at: string;
  paid_at?: string;
  ready_at?: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  max_uses: number;
  used: number;
  is_active: boolean;
  valid_until: string;
}

// ── Pricing engine ──────────────────────────────────────────────────

export interface PriceBreakdown {
  final: number;
  commission: number;
  gateway: number;
  tax: number;
  net: number;
}

export interface CartItem {
  product: Product;
  qty: number;
  notes?: string;
}
