import { PageTransition } from "@/components/customer/page-transition";

/**
 * Remonta a cada navegação dentro de (client) — garante animação de entrada
 * em todas as telas (praça, cardápio, checkout, pedidos, conta, login…).
 */
export default function ClientTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
