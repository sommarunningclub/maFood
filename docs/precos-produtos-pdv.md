# Tabela de Preços — Produtos por PDV (maFood)

> **Valor final de venda** de todos os produtos cadastrados, agrupados por PDV.
> Não inclui custo de fornecedor.

| | |
|---|---|
| **Data da extração** | 2026-07-18 |
| **Projeto / venue** | maFood — Somma Special Day |
| **Fonte** | Supabase, schema `mafood` (projeto `sommarunning_2026`, ref `riqfjewvygqsbuokvsjw`) |
| **Tabelas** | `mafood.pdvs`, `mafood.products` |
| **Acesso** | `service_role` (RLS ignorada; leitura server-side) |
| **PDVs** | 4 |
| **Produtos** | 76 (66 ativos · 10 pausados) |

---

## Metodologia — como o "preço final de venda" é definido

O preço efetivamente mostrado e cobrado ao cliente segue a regra do próprio sistema
([`src/lib/pricing.ts` → `effectivePrice()`](../src/lib/pricing.ts)):

```
preço_final = (sale_price, se preenchido e > 0)  →  senão  →  price
```

- **`price`** — preço base do produto (`numeric(10,2)`, obrigatório). Já é o valor final,
  não o de fornecedor (o líquido do lojista é sempre *calculado*, nunca armazenado).
- **`sale_price`** — override de venda opcional. Quando preenchido e positivo, prevalece
  sobre `price` para exibição e cobrança (ex.: itens do Somma Bar).
- **`supplier_cost`** — custo de aquisição/fornecedor. **Não** entra neste relatório.

**Status considerados:** todos os produtos foram incluídos (`active` e `paused`).
Itens `paused` estão fora do cardápio no momento da extração, mas mantêm preço cadastrado —
estão marcados com `⏸` nas tabelas abaixo.

> ⚠️ O "preço final" é o valor unitário de tabela. O somatório dos preços **não** é
> faturamento nem receita — é apenas a soma dos valores de venda cadastrados.

---

## Resumo por PDV

| PDV | Produtos | Ativos | Pausados | Soma dos preços (todos) | Soma (só ativos) |
|---|---:|---:|---:|---:|---:|
| Somma Bar | 23 | 23 | 0 | R$ 266,81 | R$ 266,81 |
| Crepe do Bob | 22 | 20 | 2 | R$ 230,00 | R$ 226,00 |
| DOPA HMINA – Smoothies e Shakes Proteicos | 23 | 16 | 7 | R$ 529,16 | R$ 292,32 |
| Tio Mari | 7 | 6 | 1 | R$ 269,97 | R$ 229,97 |
| **TOTAL** | **76** | **66** | **10** | **R$ 1.295,94** | **R$ 1.015,10** |

---

## Somma Bar — 23 produtos

| Preço final | Produto | Categoria | Status |
|---:|---|---|:--:|
| R$ 8,99 | Água de Coco Kero Coco 330ml | Águas | ✅ |
| R$ 5,99 | Água Mineral Indaiá com gás 500ml | Águas | ✅ |
| R$ 5,99 | Água Mineral Indaiá sem gás 500ml | Águas | ✅ |
| R$ 15,99 | Beats Senses 269ml | Bebida Alcoólica | ✅ |
| R$ 6,00 | Coca-Cola Original 310ml | Refrigerantes | ✅ |
| R$ 8,99 | Coca-Cola Zero 310ml | Refrigerantes | ✅ |
| R$ 13,99 | Corona Cero (sem álcool) Long Neck 330ml | Bebida Alcoólica | ✅ |
| R$ 13,99 | Corona Extra Long Neck 330ml | Bebida Alcoólica | ✅ |
| R$ 8,99 | Guaraná Antarctica 350ml | Refrigerantes | ✅ |
| R$ 13,99 | Heineken Long Neck 330ml | Bebida Alcoólica | ✅ |
| R$ 13,99 | Heineken Zero Long Neck 330ml | Bebida Alcoólica | ✅ |
| R$ 13,99 | Isotônico Gatorade Laranja 500ml | — | ✅ |
| R$ 13,99 | Isotônico Gatorade Limão 500ml | — | ✅ |
| R$ 11,99 | Isotônico Gatorade Morango-Maracujá 500ml | Isotônicos | ✅ |
| R$ 8,00 | Isotônico Gatorade Tangerina 500ml | — | ✅ |
| R$ 8,00 | Isotônico Gatorade Uva 500ml | Isotônicos | ✅ |
| R$ 13,99 | Michelob Ultra Long Neck 330ml | Bebida Alcoólica | ✅ |
| R$ 16,99 | Red Bull 250ml | Energético | ✅ |
| R$ 13,00 | Red Bull Sugar Free 250ml | — | ✅ |
| R$ 11,99 | Smirnoff Ice 269ml | Bebida Alcoólica | ✅ |
| R$ 13,99 | Stella Artois Pure Gold Long Neck 330ml | Bebida Alcoólica | ✅ |
| R$ 5,99 | Suco Del Valle Uva 200ml | Sucos | ✅ |
| R$ 17,99 | Xeque Mate Draft Rum (Edição Especial) 362ml | Bebida Alcoólica | ✅ |

*Todos os itens deste PDV usam `sale_price` (override de venda).*

---

## Crepe do Bob — 22 produtos

| Preço final | Produto | Categoria | Status |
|---:|---|---|:--:|
| R$ 25,00 | Crepe Banana com Canela | Doces | ✅ |
| R$ 30,00 | Crepe Banana com Nutella | Doces | ✅ |
| R$ 35,00 | Crepe de Morango | Doces | ✅ |
| R$ 25,00 | Crepe de Calabresa | Salgados | ✅ |
| R$ 30,00 | Crepe de Carne Seca | Salgados | ✅ |
| R$ 30,00 | Crepe de Frango | Salgados | ✅ |
| R$ 25,00 | Crepe de Presunto | Salgados | ✅ |
| R$ 2,00 | Açúcar com canela | Adicionais | ✅ |
| R$ 2,00 | Açúcar com nutella | Adicionais | ✅ |
| R$ 2,00 | Azeitona | Adicionais | ✅ |
| R$ 2,00 | Banana | Adicionais | ✅ |
| R$ 2,00 | Batata palha | Adicionais | ✅ |
| R$ 2,00 | Calabresa | Adicionais | ✅ |
| R$ 2,00 | Carne seca | Adicionais | ✅ |
| R$ 2,00 | Catupiry | Adicionais | ✅ |
| R$ 2,00 | Frango desfiado | Adicionais | ✅ |
| R$ 2,00 | Milho | Adicionais | ✅ |
| R$ 2,00 | Morango | Adicionais | ✅ |
| R$ 2,00 | Orégano | Adicionais | ✅ |
| R$ 2,00 | Queijo mussarela | Adicionais | ✅ |
| R$ 2,00 | Adicional | Adicionais | ⏸ |
| R$ 2,00 | Massa tradicional | Adicionais | ⏸ |

---

## DOPA HMINA – Smoothies e Shakes Proteicos — 23 produtos

| Preço final | Produto | Categoria | Status |
|---:|---|---|:--:|
| R$ 33,90 | Banoffee | Shakes proteicos | ✅ |
| R$ 33,90 | DopahCoffee | Shakes proteicos | ✅ |
| R$ 26,99 | Maracumina | Smoothies frutados | ✅ |
| R$ 26,99 | PinkDopah | Smoothies frutados | ✅ |
| R$ 26,99 | Sunset Jungle | Smoothies frutados | ✅ |
| R$ 26,99 | Yorango | Smoothies frutados | ✅ |
| R$ 15,99 | Red Bull Melancia 250 ml | Bebidas | ✅ |
| R$ 15,99 | Red Bull Pomelo 250 ml | Bebidas | ✅ |
| R$ 15,99 | Red Bull Tropical 250 ml | Bebidas | ✅ |
| R$ 15,99 | Red Bull Zero 250 ml | Bebidas | ✅ |
| R$ 6,00 | Água com gás 500 ml | Bebidas | ✅ |
| R$ 5,00 | Água 500 ml | Bebidas | ✅ |
| R$ 13,90 | Proteína vegana | Adicionais | ✅ |
| R$ 13,90 | Whey protein 30 g | Adicionais | ✅ |
| R$ 7,90 | Whey protein 15 g | Adicionais | ✅ |
| R$ 5,90 | Creatina | Adicionais | ✅ |
| R$ 44,99 | Dopah Bull · 480 ml | Smoothies com Red Bull | ⏸ |
| R$ 35,99 | DopahCoffee · 480 ml | Shakes proteicos | ⏸ |
| R$ 35,90 | Banoffee · 480 ml | Shakes proteicos | ⏸ |
| R$ 29,99 | Maracumina · 480 ml | Smoothies frutados | ⏸ |
| R$ 29,99 | PinkDopah · 480 ml | Smoothies frutados | ⏸ |
| R$ 29,99 | Sunset Jungle · 480 ml | Smoothies frutados | ⏸ |
| R$ 29,99 | Yorango · 480 ml | Smoothies frutados | ⏸ |

---

## Tio Mari — 7 produtos

| Preço final | Produto | Categoria | Status |
|---:|---|---|:--:|
| R$ 44,99 | Costela Desfiada | Pão com Carne | ✅ |
| R$ 39,99 | Queijo Coalho com Brócolis | Pão com Carne | ✅ |
| R$ 37,99 | Linguiça | Pão com Carne | ✅ |
| R$ 37,00 | Pernil com Abacaxi | Pão com Carne | ✅ |
| R$ 35,00 | Frango com Brócolis | Pão com Carne | ✅ |
| R$ 35,00 | Pernil | Pão com Carne | ✅ |
| R$ 40,00 | Coração com Vinagrete | Pão com Carne | ⏸ |

---

## Como reproduzir esta extração

Script Node (usa `service_role`, schema `mafood`), lendo as envs de `.env.local`:

```js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false }, db: { schema: "mafood" } }
);

const { data: pdvs }     = await supabase.from("pdvs").select("id, name, sort_order");
const { data: products } = await supabase
  .from("products")
  .select("id, pdv_id, name, category, price, sale_price, status");

// preço final = sale_price se > 0, senão price
const eff = (p) =>
  p.sale_price != null && Number(p.sale_price) > 0 ? Number(p.sale_price) : Number(p.price ?? 0);
```

> **Nota:** o schema `mafood` só é acessível via `service_role` (anon/authenticated
> revogados). Nunca chamar do client — sempre server-side.

<!-- Legenda de status: ✅ active · ⏸ paused (fora do cardápio, preço mantido) -->
