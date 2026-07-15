import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { AccountView } from "@/components/customer/account-view";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: { venue: string } }) {
  const session = await getCustomerSession();
  if (!session) redirect(`/${params.venue}/login?next=/${params.venue}/account`);

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, cpf, email, phone, postal_code, address_number, address_complement, is_vip, created_at")
    .eq("id", session.customer_id)
    .maybeSingle();
  if (!customer) redirect(`/${params.venue}/login`);

  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", session.customer_id);

  return (
    <AccountView
      venue={params.venue}
      customer={customer}
      ordersCount={count ?? 0}
    />
  );
}
