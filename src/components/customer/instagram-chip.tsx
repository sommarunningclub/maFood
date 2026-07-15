"use client";

/*
  Link de Instagram que precisa parar a propagação de cliques
  (evita disparar o Link pai do cartão de PDV). Em Server Components
  não é possível passar onClick — daí o client component dedicado.
*/
export function InstagramChip({
  handle,
  variant = "default",
}: {
  handle: string;
  variant?: "default" | "onDark";
}) {
  const clean = handle.replace(/^@/, "");
  const base =
    "inline-flex items-center gap-1 text-[13px] font-medium transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  const styles =
    variant === "onDark"
      ? "text-white/90 focus-visible:outline-white"
      : "text-mafood-primary-strong focus-visible:outline-mafood-primary hover:underline";

  return (
    <a
      href={`https://instagram.com/${clean}`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`${base} ${styles}`}
      aria-label={`Instagram @${clean}`}
    >
      @{clean}
    </a>
  );
}
