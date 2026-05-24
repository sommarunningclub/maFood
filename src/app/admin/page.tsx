import Link from "next/link";
import {
  Smartphone,
  Tablet,
  LayoutDashboard,
  ScrollText,
  Store,
  Package,
  Percent,
  DollarSign,
  ArrowUpRight,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/page-header";

/*
  Hub do backoffice — primeira tela após login.
  Apresenta os três ambientes do maFood e atalhos para as áreas de gestão.
*/
export const dynamic = "force-dynamic";

export default async function AdminHub() {
  // Busca dados leves para enriquecer os cards
  const supa = createAdminClient();
  const [{ data: venue }, { count: pdvCount }, { count: productCount }] = await Promise.all([
    supa.from("venues").select("slug, name").eq("is_active", true).limit(1).maybeSingle(),
    supa.from("pdvs").select("id", { count: "exact", head: true }),
    supa.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const venueSlug = venue?.slug ?? "somma-special-day";
  const venueName = venue?.name ?? "Somma Special Day";

  const environments = [
    {
      tag: "CLIENTE · PWA",
      title: "Marketplace",
      desc: "Praça de alimentação mobile-first. Cardápio, carrinho, Pix e tracking em tempo real.",
      href: `/${venueSlug}`,
      external: true,
      Icon: Smartphone,
      accent: "text-somma-orange",
      meta: `${productCount ?? 0} produtos ativos`,
    },
    {
      tag: "PDV · TABLET",
      title: "Painel Operacional",
      desc: "Kanban de 5 colunas com DnD, cardápio self-service, criação manual de pedidos com Pix.",
      href: `/loja`,
      external: false,
      Icon: Tablet,
      accent: "text-palantir-blue",
      meta: `${pdvCount ?? 0} PDVs cadastrados`,
    },
    {
      tag: "ADMIN · DESKTOP",
      title: "Gestão & Indicadores",
      desc: "Dashboard, pedidos, PDVs, produtos, cupons e espelho financeiro.",
      href: "/admin/dashboard",
      external: false,
      Icon: LayoutDashboard,
      accent: "text-palantir-green",
      meta: `Evento: ${venueName}`,
    },
  ];

  const shortcuts = [
    { href: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/admin/orders", label: "Pedidos", Icon: ScrollText },
    { href: "/admin/pdvs", label: "PDVs", Icon: Store },
    { href: "/admin/products", label: "Produtos", Icon: Package },
    { href: "/admin/coupons", label: "Cupons", Icon: Percent },
    { href: "/admin/financial", label: "Financeiro", Icon: DollarSign },
  ];

  return (
    <>
      <PageHeader
        title="maFood · centro de controle"
        subtitle="Três ambientes · uma operação"
      />

      <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Cards dos três ambientes */}
        <section>
          <p className="mono text-[10px] uppercase tracking-widest text-palantir-muted mb-3">
            Ambientes
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-palantir-border border border-palantir-border">
            {environments.map((env) => {
              const card = (
                <div className="group h-full bg-palantir-surface hover:bg-palantir-surface2 p-5 sm:p-6 transition-colors flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <env.Icon className={`size-7 shrink-0 ${env.accent}`} />
                    <ArrowUpRight className="size-4 text-palantir-muted group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                  </div>
                  <div>
                    <p className={`mono text-[10px] tracking-widest ${env.accent}`}>{env.tag}</p>
                    <h2 className="text-lg sm:text-xl font-semibold text-white mt-1">
                      {env.title}
                    </h2>
                    <p className="text-sm text-palantir-muted mt-1 leading-snug">{env.desc}</p>
                  </div>
                  <p className="mono text-[10px] text-palantir-muted/70 mt-auto pt-2 border-t border-palantir-border">
                    {env.meta}
                  </p>
                </div>
              );
              return env.external ? (
                <a
                  key={env.href}
                  href={env.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block focus-ring-admin"
                >
                  {card}
                </a>
              ) : (
                <Link key={env.href} href={env.href} className="block focus-ring-admin">
                  {card}
                </Link>
              );
            })}
          </div>
        </section>

        {/* Atalhos rápidos das áreas internas */}
        <section>
          <p className="mono text-[10px] uppercase tracking-widest text-palantir-muted mb-3">
            Áreas de gestão
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-palantir-border border border-palantir-border">
            {shortcuts.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="bg-palantir-surface hover:bg-palantir-surface2 p-4 flex flex-col items-start gap-2 transition-colors focus-ring-admin"
              >
                <s.Icon className="size-4 text-palantir-muted" />
                <span className="text-sm text-palantir-text">{s.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
