import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { LojaLogin } from "@/components/pdv/loja-login";

export const dynamic = "force-dynamic";

export default async function LojaLoginPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { next?: string };
}) {
  const supabase = createAdminClient();
  const { data: pdv } = await supabase
    .from("pdvs")
    .select("slug, name, logo_url, category, instagram_handle, pin_set_at")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!pdv) notFound();

  return (
    <LojaLogin
      pdv={pdv as {
        slug: string;
        name: string;
        logo_url: string;
        category: string | null;
        instagram_handle: string | null;
        pin_set_at: string | null;
      }}
      next={searchParams.next}
    />
  );
}
