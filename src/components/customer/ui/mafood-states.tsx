import { SearchX, AlertTriangle } from "lucide-react";

/**
 * Estados vazios / erro / carregamento do design system maFood (light).
 * Sem spinners — skeletons usam blocos suaves com animate-pulse.
 */

export function EmptyState({
  title,
  hint,
  icon: Icon = SearchX,
}: {
  title: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-mafood-md bg-mafood-background-soft text-mafood-primary-strong">
        <Icon className="size-6" />
      </span>
      <p className="text-mafood-text-primary text-[15px] font-medium text-balance">
        {title}
      </p>
      {hint && (
        <p className="text-mafood-text-muted text-sm max-w-xs text-pretty">
          {hint}
        </p>
      )}
    </div>
  );
}

export function ErrorState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-mafood-md bg-mafood-background-soft text-mafood-accent">
        <AlertTriangle className="size-6" />
      </span>
      <p className="text-mafood-text-primary text-[15px] font-medium text-balance">
        {title}
      </p>
      {hint && (
        <p className="text-mafood-text-muted text-sm max-w-xs text-pretty">
          {hint}
        </p>
      )}
    </div>
  );
}

export function LoadingSkeleton({
  variant = "card",
}: {
  variant?: "card" | "row";
}) {
  if (variant === "row") {
    return (
      <div className="flex gap-3 rounded-mafood-lg border border-mafood-border bg-mafood-surface-strong p-3 shadow-mafood-sm">
        <div className="min-w-0 flex-1 space-y-2 py-0.5">
          <div className="h-4 w-3/4 rounded-full bg-mafood-background-soft animate-pulse" />
          <div className="h-3 w-full rounded-full bg-mafood-background-soft animate-pulse" />
          <div className="h-3 w-1/3 rounded-full bg-mafood-background-soft animate-pulse" />
        </div>
        <div className="size-[88px] shrink-0 rounded-mafood-md bg-mafood-background-soft animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-mafood-lg bg-mafood-surface-strong border border-mafood-border p-4 shadow-mafood-sm">
      <div className="size-14 rounded-full bg-mafood-background-soft animate-pulse" />
      <div className="mt-4 h-4 w-3/4 rounded-full bg-mafood-background-soft animate-pulse" />
      <div className="mt-2 h-3 w-1/2 rounded-full bg-mafood-background-soft animate-pulse" />
      <div className="mt-4 h-6 w-2/3 rounded-full bg-mafood-background-soft animate-pulse" />
    </div>
  );
}
