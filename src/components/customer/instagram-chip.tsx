"use client";

/*
  Link de Instagram que precisa parar a propagação de cliques
  (evita disparar o Link pai do cartão de PDV). Em Server Components
  não é possível passar onClick — daí o client component dedicado.
*/
export function InstagramChip({ handle }: { handle: string }) {
  return (
    <a
      href={`https://instagram.com/${handle}`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-somma-orange hover:underline"
    >
      @{handle}
    </a>
  );
}
