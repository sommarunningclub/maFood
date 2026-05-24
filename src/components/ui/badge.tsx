import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

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
  pending: "bg-palantir-yellow/15 text-palantir-yellow border-palantir-yellow/30",
  paid: "bg-somma-orange/15 text-somma-orange border-somma-orange/30",
  preparing: "bg-palantir-blue/15 text-palantir-blue border-palantir-blue/30",
  ready: "bg-palantir-green/15 text-palantir-green border-palantir-green/30",
  partial: "bg-somma-orange/15 text-somma-orange border-somma-orange/30",
  delivered: "bg-palantir-muted/15 text-palantir-muted border-palantir-muted/30",
  cancelled: "bg-palantir-red/15 text-palantir-red border-palantir-red/30",
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide border",
        STATUS_CLASS[status],
        className
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[11px] font-medium border border-palantir-border text-palantir-muted",
        className
      )}
    >
      {children}
    </span>
  );
}
