import { redirect } from "next/navigation";

export default function LojaIndex({ params }: { params: { slug: string } }) {
  redirect(`/loja/${params.slug}/pedidos`);
}
