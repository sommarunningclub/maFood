import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  // QR codes impressos dos PDVs do "Somma Special Day" → home.
  //
  // PROBLEMA: o QR impresso e o clique no card do PDV dentro do app usam a MESMA
  // URL (/somma-special-day/<pdv>). Um redirect por caminho pegava os dois e
  // mandava o cliente pra home ao navegar no app.
  //
  // SOLUÇÃO: só redireciona quando NÃO é navegação interna. Usamos o header
  // `Sec-Fetch-Site`, que o browser envia sozinho:
  //   - scan de QR / link direto / bookmark = navegação de topo => "none"
  //   - clique num card dentro do app (same-origin) => "same-origin"
  // Com `has: sec-fetch-site == none`, o clique no app (same-origin) NÃO casa a
  // regra => abre o menu normalmente; o QR (none) => home.
  //
  // NÃO redirecionamos /somma-special-day (a "Praça" já É a home — a raiz "/"
  // redireciona pra lá; redirecioná-la criava loop ERR_TOO_MANY_REDIRECTS).
  // Enumeramos só os 4 slugs de PDV para não tocar em login/checkout/order.
  // permanent: false = 307 (reversível): remova estas regras p/ voltar ao menu.
  async redirects() {
    const pdvs = ["crepe-do-bob", "dopahmina", "somma-bear", "tiomario"];
    return pdvs.map((slug) => ({
      source: `/somma-special-day/${slug}`,
      has: [{ type: "header", key: "sec-fetch-site", value: "none" }],
      destination: "/",
      permanent: false,
    }));
  },
};

export default withSerwist(nextConfig);
