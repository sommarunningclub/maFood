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
  pending: "bg-mafood-accent/12 text-mafood-accent-dark",
  paid: "bg-mafood-success/12 text-mafood-success-strong",
  preparing: "bg-mafood-primary/12 text-mafood-primary",
  ready: "bg-mafood-success/12 text-mafood-success-strong",
  partial: "bg-mafood-accent/12 text-mafood-accent-dark",
  delivered: "bg-mafood-text-muted/12 text-mafood-text-secondary",
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
