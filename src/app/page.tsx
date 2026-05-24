import Link from "next/link";
import { VENUE, PDVS } from "@/lib/mock-data";

const ENTRIES = [
  {
    href: `/${VENUE.slug}`,
    tag: "CLIENTE · PWA",
    title: "Marketplace",
    desc: "Praça de alimentação mobile-first. Cardápio, carrinho, Pix e acompanhamento em tempo real.",
    accent: "text-somma-orange",
  },
  {
    href: `/pdv/${PDVS[0].slug}`,
    tag: "PDV · TABLET",
    title: "Painel Operacional",
    desc: "Kanban de pedidos em 5 colunas, gestão de cardápio e notificações ao vivo.",
    accent: "text-palantir-blue",
  },
  {
    href: "/admin",
    tag: "ADMIN · DESKTOP",
    title: "Backoffice",
    desc: "Dashboard, pedidos, PDVs, produtos, cupons e espelho financeiro.",
    accent: "text-palantir-green",
  },
];

export default function Home() {
  return (
    <main className="theme-admin min-h-screen palantir-grid flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <header className="mb-10">
          <p className="mono text-xs text-palantir-muted tracking-[0.3em] mb-2">
            MAFOOD · OPERATIONAL PLATFORM
          </p>
          <h1 className="text-4xl font-semibold text-white">
            Praça de alimentação digital
          </h1>
          <p className="text-palantir-muted mt-2">
            Três interfaces · {VENUE.name}
          </p>
        </header>

        <div className="grid gap-px bg-palantir-border border border-palantir-border">
          {ENTRIES.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="group bg-palantir-surface hover:bg-palantir-surface2 p-6 transition-colors flex items-center gap-6"
            >
              <div className="flex-1">
                <p className={`mono text-[11px] tracking-widest mb-1 ${e.accent}`}>
                  {e.tag}
                </p>
                <h2 className="text-xl font-semibold text-white">{e.title}</h2>
                <p className="text-sm text-palantir-muted mt-1">{e.desc}</p>
              </div>
              <span className="text-palantir-muted group-hover:text-white group-hover:translate-x-1 transition-all text-2xl">
                →
              </span>
            </Link>
          ))}
        </div>

        <p className="mono text-[11px] text-palantir-muted mt-8 text-center">
          dados mockados · supabase + asaas a integrar
        </p>
      </div>
    </main>
  );
}
