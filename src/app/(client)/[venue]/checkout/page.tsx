import { CheckoutView } from "@/components/customer/checkout-view";

export default function CheckoutPage({ params }: { params: { venue: string } }) {
  return <CheckoutView venue={params.venue} />;
}
