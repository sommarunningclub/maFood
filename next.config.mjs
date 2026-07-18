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
  // Os QR codes impressos dos PDVs do "Somma Special Day" apontam para
  // /somma-special-day (praça) e /somma-special-day/<pdv>. Redireciona todos
  // para a home. permanent: false = 307 (temporário/reversível): basta remover
  // estas regras para os menus voltarem a abrir pelo QR. Rotas com 2+ segmentos
  // (ex.: /somma-special-day/order/[id]) NÃO são afetadas, preservando o
  // acompanhamento de pedido de quem já comprou.
  async redirects() {
    return [
      { source: "/somma-special-day", destination: "/", permanent: false },
      { source: "/somma-special-day/:pdv", destination: "/", permanent: false },
    ];
  },
};

export default withSerwist(nextConfig);
