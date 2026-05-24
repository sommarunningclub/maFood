import { CombosView } from "@/components/pdv/combos-view";

export const dynamic = "force-dynamic";

export default function CombosPage({ params }: { params: { slug: string } }) {
  return <CombosView slug={params.slug} />;
}
