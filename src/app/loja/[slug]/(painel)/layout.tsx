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
    <div className="theme-admin flex min-h-screen">
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
      <main className="palantir-grid flex-1 overflow-auto">{children}</main>
    </div>
  );
}
