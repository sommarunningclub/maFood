/*
  Estoque de produtos.
  - stock_quantity = null  → sem controle (ilimitado)
  - stock_quantity >= 0    → controlado; bloqueia venda em 0; auto-marca
                              status='out_of_stock' quando zera.
*/
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

type Item = { product_id: string; qty: number; name?: string };

/**
 * Valida que cada item tem estoque suficiente. Retorna erro legível ou null.
 * Use ANTES de criar o pedido. Não modifica nada.
 */
export async function validateStock(
  supabase: SupabaseLike,
  items: Item[]
): Promise<string | null> {
  if (items.length === 0) return null;
  const ids = items.map((i) => i.product_id);
  const { data, error } = await supabase
    .from("products")
    .select("id, name, stock_quantity")
    .in("id", ids);
  if (error) return "Erro ao verificar estoque";
  type ProductRow = { id: string; name?: string; stock_quantity: number | null };
  const rows = (data ?? []) as ProductRow[];
  const byId = new Map<string, ProductRow>(rows.map((p) => [p.id, p]));
  // Soma qty por produto (caso item venha repetido)
  const totalByProduct = new Map<string, number>();
  for (const it of items) {
    totalByProduct.set(it.product_id, (totalByProduct.get(it.product_id) ?? 0) + it.qty);
  }
  for (const [pid, qty] of totalByProduct) {
    const p = byId.get(pid);
    if (!p) continue;
    if (p.stock_quantity != null && p.stock_quantity < qty) {
      const label = p.name ?? "produto";
      return p.stock_quantity === 0
        ? `Sem estoque: ${label}`
        : `Estoque insuficiente: ${label} (restam ${p.stock_quantity})`;
    }
  }
  return null;
}

/**
 * Decrementa estoque dos itens do pedido. Best-effort: log + segue.
 * Quando um produto chega a 0, marca status='out_of_stock' automaticamente.
 * Idempotência: chame só na transição pra "paid".
 */
export async function decrementStockForOrder(
  supabase: SupabaseLike,
  orderId: string
): Promise<void> {
  const { data: items, error } = await supabase
    .from("order_items")
    .select("product_id, qty")
    .eq("order_id", orderId);
  if (error || !items) {
    console.error("[stock] failed to fetch items", { orderId, error });
    return;
  }
  type OrderItemRow = { product_id: string | null; qty: number };
  const rows = items as OrderItemRow[];
  const byProduct = new Map<string, number>();
  for (const it of rows) {
    if (!it.product_id) continue;
    byProduct.set(it.product_id, (byProduct.get(it.product_id) ?? 0) + (it.qty ?? 0));
  }
  if (byProduct.size === 0) return;

  const ids = Array.from(byProduct.keys());
  const { data: prods } = await supabase
    .from("products")
    .select("id, stock_quantity")
    .in("id", ids);

  type StockRow = { id: string; stock_quantity: number | null };
  for (const p of (prods ?? []) as StockRow[]) {
    if (p.stock_quantity == null) continue;
    const dec = byProduct.get(p.id) ?? 0;
    const next = Math.max(0, p.stock_quantity - dec);
    const patch: Record<string, unknown> = { stock_quantity: next };
    if (next === 0) patch.status = "out_of_stock";
    await supabase.from("products").update(patch).eq("id", p.id);
  }
}
