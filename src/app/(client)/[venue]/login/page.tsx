import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { CustomerLogin } from "@/components/customer/login";

export const dynamic = "force-dynamic";

export default async function CustomerLoginPage({
  params,
  searchParams,
}: {
  params: { venue: string };
  searchParams: { next?: string; cpf?: string };
}) {
  // Se já está logado, redireciona
  const existing = await getCustomerSession();
  if (existing) {
    redirect(searchParams.next && searchParams.next.startsWith(`/${params.venue}`)
      ? searchParams.next
      : `/${params.venue}`);
  }

  const supabase = createAdminClient();
  const { data: venue } = await supabase
    .from("venues")
    .select("name, description")
    .eq("slug", params.venue)
    .maybeSingle();

  return (
    <CustomerLogin
      venue={params.venue}
      venueName={venue?.name ?? "Evento"}
      next={searchParams.next}
      initialCpf={searchParams.cpf}
    />
  );
}
