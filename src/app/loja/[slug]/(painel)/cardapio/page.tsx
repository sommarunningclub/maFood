import { CardapioView } from "@/components/pdv/cardapio-view";

export const dynamic = "force-dynamic";

export default function CardapioPage({ params }: { params: { slug: string } }) {
  return <CardapioView slug={params.slug} />;
}
