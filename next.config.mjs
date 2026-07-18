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
  // A raiz "/" já redireciona para /somma-special-day (a home do marketplace),
  // então NÃO redirecionamos /somma-special-day: a "Praça" já É a home. (Fazer
  // isso criava um loop /somma-special-day <-> / => ERR_TOO_MANY_REDIRECTS.)
  //
  // Enumeramos apenas os slugs dos 4 PDVs — em vez de um "/:pdv" genérico —
  // para não afetar as rotas funcionais do venue (login, checkout, account,
  // history, order) e assim preservar o acompanhamento de pedido.
  //
  // permanent: false = 307 (reversível): basta remover estas regras para os
  // menus dos PDVs voltarem a abrir pelo QR.
  async redirects() {
    const pdvs = ["crepe-do-bob", "dopahmina", "somma-bear", "tiomario"];
    return pdvs.map((slug) => ({
      source: `/somma-special-day/${slug}`,
      destination: "/",
      permanent: false,
    }));
  },
};

export default withSerwist(nextConfig);
