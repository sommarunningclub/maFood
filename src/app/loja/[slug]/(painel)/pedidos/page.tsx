import { Pedidos } from "@/components/pdv/pedidos";

export const dynamic = "force-dynamic";

export default function PedidosPage({ params }: { params: { slug: string } }) {
  return <Pedidos slug={params.slug} />;
}
