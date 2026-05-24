import { OrderTracker } from "@/components/customer/order-tracker";

export default function OrderPage({
  params,
}: {
  params: { venue: string; orderId: string };
}) {
  return <OrderTracker venue={params.venue} orderId={params.orderId} />;
}
