# QR codes do "Somma Special Day" → redirect para a home

> Documentação da regra que faz os QR codes impressos dos PDVs abrirem a home
> do marketplace, **sem** quebrar a navegação dentro do app.
>
> Última atualização: 2026-07-18 · Deploy vigente: commit `2e0e3d0`

---

## 1. Contexto

Foram gerados **QR codes impressos (artes A4)** para cada PDV do evento
**Somma Special Day**, colados fisicamente nos pontos de venda. Ao escanear, o
cliente abria o cardápio daquele PDV.

O pedido foi: **todos os QR codes devem levar para a home**
`https://food.sommaclub.com.br/` em vez do cardápio específico de cada PDV.

As artes ficam em [`artes/`](../artes/):

| Arte (PDF A4) | URL codificada no QR | Escopo |
|---|---|---|
| `SommaFood-A4-Praca.pdf` | `food.sommaclub.com.br/somma-special-day` | PDV (Praça) |
| `SommaFood-A4-Crepe-do-Bob.pdf` | `food.sommaclub.com.br/somma-special-day/crepe-do-bob` | PDV |
| `SommaFood-A4-DOPA-HMINA.pdf` | `food.sommaclub.com.br/somma-special-day/dopahmina` | PDV |
| `SommaFood-A4-Somma-Bar.pdf` | `food.sommaclub.com.br/somma-special-day/somma-bear` | PDV |
| `SommaFood-A4-Tio-Mari.pdf` | `food.sommaclub.com.br/somma-special-day/tiomario` | PDV |
| `LojaSomma-QR` (svg/png/pdf) | `loja.sommaclub.com.br/` | **Fora de escopo** (outro subdomínio) |
| `PIX-SommaClub-QR` (svg/png/pdf) | payload PIX (não é URL) | **Fora de escopo** (pagamento) |

> Os valores acima foram obtidos **decodificando** os QR das artes (o QR
> impresso não guarda a URL em texto legível). Só os 5 `SommaFood-A4-*`
> entram na regra; `LojaSomma` e `PIX` ficam de fora.

---

## 2. Os dois problemas que tornam isso não-trivial

### 2.1 A raiz `/` já redireciona para o venue (risco de loop)

Neste app, `https://food.sommaclub.com.br/` **não fica na raiz**: ela faz
`307 → /somma-special-day`. Ou seja, **o venue `somma-special-day` É a home**
do marketplace.

Consequência: redirecionar `/somma-special-day` de volta para `/` cria um
**loop infinito** e derruba o site inteiro (inclusive a raiz):

```
/  →  /somma-special-day  →  /  →  /somma-special-day  →  …   (ERR_TOO_MANY_REDIRECTS)
```

➡️ **Nunca** redirecione `/somma-special-day` (nem a raiz `/`) para `/`. A
"Praça" (`/somma-special-day`) **já é a home** — o QR dela não precisa de
regra nenhuma.

### 2.2 QR impresso e clique no app usam a MESMA URL

O QR do "Crepe do Bob" e o card "Crepe do Bob" dentro do app apontam ambos
para `/somma-special-day/crepe-do-bob`. Um redirect por caminho não distingue
"cheguei escaneando o QR" de "cliquei no card navegando no app" — os dois são
GET para a mesma URL.

Resultado do primeiro approach ingênuo: o cliente navegando no app clicava no
PDV e **voltava pra home**. Errado.

➡️ Precisamos de um sinal que diferencie **entrada externa** (scan de QR) de
**navegação interna** (clique no app).

---

## 3. A solução

Regra em [`next.config.mjs`](../next.config.mjs) → `redirects()`, condicionada
pelo header **`Sec-Fetch-Site`** (enviado pelo próprio navegador, o app não
controla):

| Como o cliente chega | `Sec-Fetch-Site` | O que acontece |
|---|---|---|
| Escaneia o QR impresso / abre link direto | `none` | **307 → home** |
| Clica no card do PDV dentro do app (same-origin) | `same-origin` | **abre o menu** (sem redirect) |

```js
// next.config.mjs
async redirects() {
  const pdvs = ["crepe-do-bob", "dopahmina", "somma-bear", "tiomario"];
  return pdvs.map((slug) => ({
    source: `/somma-special-day/${slug}`,
    has: [{ type: "header", key: "sec-fetch-site", value: "none" }],
    destination: "/",
    permanent: false, // 307 → reversível
  }));
}
```

Decisões de design:

- **`has: sec-fetch-site == none`** → só dispara em entrada externa; clique no
  app (`same-origin`) não casa a regra e abre o menu normalmente.
- **Slugs enumerados** (não um `/:pdv` genérico) → não afeta as rotas
  funcionais do venue (`login`, `checkout`, `account`, `history`, `order`).
- **Não inclui `/somma-special-day`** → a Praça já é a home (evita o loop da
  seção 2.1).
- **`permanent: false` (307)** → reversível; navegador não cacheia pra sempre.
  Bom para QR físico caso a decisão mude.
- **Destino `/`** → resolve para `/somma-special-day` (a home) em 1 hop extra;
  mantém a intenção literal "ir para a raiz" e é à prova de mudança futura da
  home.

---

## 4. Matriz de comportamento (verificada em produção)

| Rota | Contexto | Resultado |
|---|---|---|
| `/somma-special-day` (Praça) | qualquer | 200 — é a home |
| `/somma-special-day/<pdv>` | clique no app (`same-origin`) | 200 — abre o menu ✅ |
| `/somma-special-day/<pdv>` | scan de QR / direto (`none`) | 307 → home ✅ |
| `/` (raiz) | qualquer | 200 (via `/somma-special-day`), sem loop ✅ |
| `/somma-special-day/login` | qualquer | 200 — intacto ✅ |
| `/somma-special-day/order/[id]` | qualquer | preservado (fluxo de acompanhamento) ✅ |

---

## 5. Caveat conhecido

Como o sinal é "entrada externa vs navegação interna", os casos abaixo caem na
**home junto com o QR** (são tecnicamente entradas novas, iguais a um scan):

- **Refresh (F5 / puxar pra atualizar)** enquanto o cliente está no cardápio de
  um PDV.
- **Bookmark / link compartilhado** de um PDV aberto diretamente.

Não é possível separar 100% esses casos de um scan de QR — é o mesmo tipo de
acesso de topo. Na prática é raro. Se um dia isso incomodar, a alternativa é
remover o redirect (ver seção 6).

---

## 6. Como reverter / operar

### Reativar os menus dos PDVs pelo QR (desfazer tudo)
Remova o bloco `redirects()` de [`next.config.mjs`](../next.config.mjs) e faça
deploy. Como é 307 (não cacheado permanentemente), os QR voltam a abrir os
cardápios. (`LojaSomma` e `PIX` nunca foram afetados.)

### Adicionar um novo PDV à regra
Inclua o slug no array `pdvs` em `next.config.mjs`:

```js
const pdvs = ["crepe-do-bob", "dopahmina", "somma-bear", "tiomario", "novo-pdv"];
```

### Descobrir o que um QR impresso codifica (decodificar)
Os QR não guardam a URL em texto. Para decodificar um PDF/PNG das artes:

```bash
python3 -m pip install pymupdf opencv-python-headless numpy
python3 - <<'PY'
import fitz, cv2, numpy as np
doc = fitz.open("artes/SommaFood-A4-Crepe-do-Bob.pdf")
pix = doc[0].get_pixmap(dpi=300)
img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)
img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR if pix.n == 3 else cv2.COLOR_RGBA2BGR)
print(cv2.QRCodeDetector().detectAndDecode(img)[0])
PY
```

---

## 7. Deploy

O projeto é conectado ao **GitHub** (`sommarunningclub/maFood`) com integração
Vercel: **push na `main` = deploy de produção**.

> ⚠️ **Não** use `vercel --prod` pelo CLI aqui: ele sobe o working directory
> inteiro (incluindo alterações não commitadas / WIP). Faça deploy via
> `git push origin main`, que publica exatamente o commit.

### Histórico desta funcionalidade
| Commit | O que fez |
|---|---|
| `3007dae` | 1ª versão — redirecionava `/somma-special-day` e `/:pdv` → **causou o loop** |
| `7b4601a` | corrigiu o loop (não redireciona mais a Praça; enumera os 4 slugs) |
| `2e0e3d0` | adiciona a condição `Sec-Fetch-Site: none` → preserva o clique no app |

---

## 8. Referências no código
- Regra de redirect: [`next.config.mjs`](../next.config.mjs)
- Roteamento do cliente: `src/middleware.ts` (venue `/[venue]/...`)
- Página do venue/PDV: `src/app/(client)/[venue]/[pdv]/page.tsx`
- Artes dos QR: [`artes/`](../artes/)
