import { CheckoutView } from "@/components/customer/checkout-view";
import { getCustomerSession } from "@/lib/auth/customer-session";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: { venue: string } }) {
  const session = await getCustomerSession();
  return <CheckoutView venue={params.venue} initialHasSession={!!session} />;
}
