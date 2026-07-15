import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";
import { PdvSidebar } from "@/components/pdv/sidebar";

export const dynamic = "force-dynamic";

export default async function PainelPdvLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const session = await getPdvSession();
  if (!session) redirect(`/loja/${params.slug}/login`);
  if (session.pdv_slug !== params.slug) {
    redirect(`/loja/${session.pdv_slug}/pedidos`);
  }

  const supabase = createAdminClient();
  const { data: pdv } = await supabase
    .from("pdvs")
    .select("id, slug, name, logo_url, category, instagram_handle, is_open")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!pdv) notFound();

  return (
    <div className="theme-admin flex min-h-dvh-100">
      <PdvSidebar
        pdv={{
          slug: pdv.slug,
          name: pdv.name,
          logo_url: pdv.logo_url,
          category: pdv.category,
          instagram_handle: pdv.instagram_handle,
          is_open: pdv.is_open,
        }}
      />
      {/*
        Em mobile (<md): top bar (3.25rem) + bottom nav (~3.5rem).
        Reservamos espaço com padding para o conteúdo não ser coberto.
        Em md+: sidebar fixa lateral, main ocupa o resto.
      */}
      <main className="palantir-grid flex-1 min-w-0 overflow-x-hidden pt-[calc(3.25rem_+_env(safe-area-inset-top))] pb-[calc(3.75rem_+_env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  );
}
