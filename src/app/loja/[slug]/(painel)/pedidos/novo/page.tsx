import { ManualOrderForm } from "@/components/pdv/manual-order-form";

export const dynamic = "force-dynamic";

export default function NovoPedidoPage({ params }: { params: { slug: string } }) {
  return <ManualOrderForm slug={params.slug} />;
}
