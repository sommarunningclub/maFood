"use client";

/**
 * Trilho horizontal de categorias — cards ~140×88 com snap.
 * onSelect recebe a categoria escolhida ou "all".
 */

export function CategoryCard({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const isAll = label === "Tudo";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`relative snap-start shrink-0 h-[88px] w-[140px] overflow-hidden rounded-mafood-md text-left transition-transform duration-200 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary ${
        active
          ? "shadow-mafood-md ring-2 ring-mafood-primary"
          : "shadow-mafood-sm ring-1 ring-mafood-border"
      }`}
    >
      <span
        className={`absolute inset-0 ${
          active || isAll
            ? "mafood-header-gradient"
            : "bg-mafood-surface-strong"
        }`}
      />
      {!active && !isAll && (
        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-mafood-background-soft to-transparent" />
      )}
      <span
        className={`relative z-10 flex h-full items-end p-3 font-serif text-[15px] leading-tight ${
          active || isAll ? "text-white" : "text-mafood-text-primary"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function HorizontalCategoryList({
  categories,
  active,
  onSelect,
}: {
  categories: string[];
  active: string;
  onSelect: (value: string) => void;
}) {
  if (categories.length === 0) return null;

  const items = ["all", ...categories];

  return (
    <div
      className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 scroll-snap-x"
      role="group"
      aria-label="Filtrar por categoria"
    >
      {items.map((cat) => (
        <CategoryCard
          key={cat}
          label={cat === "all" ? "Tudo" : cat}
          active={active === cat}
          onSelect={() => onSelect(cat)}
        />
      ))}
    </div>
  );
}
