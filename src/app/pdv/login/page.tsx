import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PdvLogo } from "@/components/pdv-logo";

export const dynamic = "force-dynamic";

export default async function PdvSelectPage() {
  const supabase = createAdminClient();
  const { data: pdvs } = await supabase
    .from("pdvs")
    .select("slug, name, category, logo_url, instagram_handle, pin_set_at, is_open")
    .order("sort_order", { ascending: true });

  return (
    <div className="theme-admin min-h-screen palantir-grid p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl mt-6">
        <p className="mono text-[10px] tracking-[0.3em] text-palantir-muted mb-1">
          MAFOOD · PAINEL OPERACIONAL
        </p>
        <h1 className="text-3xl font-semibold text-white">Escolha seu PDV</h1>
        <p className="text-palantir-muted text-sm mt-1">
          Toque no seu ponto de venda e digite o PIN para entrar.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(pdvs ?? []).map((p) => {
            const noPin = !p.pin_set_at;
            return (
              <Link
                key={p.slug}
                href={`/loja/${p.slug}/login`}
                className="rounded-admin border border-palantir-border bg-palantir-surface p-4 hover:border-palantir-blue/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <PdvLogo logoUrl={p.logo_url} size={44} />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-white font-medium truncate">{p.name}</h2>
                    <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
                      {p.category || "PDV"}
                    </p>
                    {p.instagram_handle && (
                      <p className="mono text-[10px] text-palantir-blue mt-0.5">
                        @{p.instagram_handle}
                      </p>
                    )}
                  </div>
                  <span className="text-palantir-muted group-hover:text-palantir-blue group-hover:translate-x-0.5 transition-all">
                    →
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`mono text-[9px] uppercase px-1.5 py-0.5 ${
                      p.is_open
                        ? "bg-palantir-green/10 text-palantir-green"
                        : "bg-palantir-red/10 text-palantir-red"
                    }`}
                  >
                    ● {p.is_open ? "ABERTO" : "FECHADO"}
                  </span>
                  {noPin && (
                    <span className="mono text-[9px] uppercase bg-palantir-yellow/10 text-palantir-yellow px-1.5 py-0.5">
                      PIN PENDENTE
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {(!pdvs || pdvs.length === 0) && (
          <p className="text-palantir-muted text-sm mt-6 text-center">
            Nenhum PDV cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
