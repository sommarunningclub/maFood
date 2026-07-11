import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

// Mirrors the label strings from the shared admin badge (src/components/ui/badge.tsx)
// but uses maFood tokens with AA-passing foregrounds instead of the dark-admin
// tokens used there, which fail contrast on the light customer surface.
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Aguardando",
  paid: "Pago",
  preparing: "Em preparo",
  ready: "Pronto",
  partial: "Parcial",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  // Neutral — payment not confirmed yet, nothing active happening.
  // Was accent-dark (identical to `cancelled`/`partial`, confusable); now neutral grey.
  pending: "bg-mafood-text-muted/12 text-mafood-text-secondary",
  // Terminal-good statuses share the amber success treatment; label text differentiates them.
  paid: "bg-mafood-success/12 text-mafood-success-strong",
  preparing: "bg-mafood-primary/12 text-mafood-primary-strong",
  ready: "bg-mafood-success/12 text-mafood-success-strong",
  // Was accent-dark (identical to `cancelled`); partial pickup is terminal-good, so success-strong.
  partial: "bg-mafood-success/12 text-mafood-success-strong",
  // Was neutral grey; delivered is terminal-good, so success-strong.
  delivered: "bg-mafood-success/12 text-mafood-success-strong",
  // Stays red-ish/accent-dark — distinct from orange/amber, never confusable with success.
  cancelled: "bg-mafood-accent/12 text-mafood-accent-dark",
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-mafood-sm px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        STATUS_CLASS[status],
        className
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
