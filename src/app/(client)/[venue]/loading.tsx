import { LoadingSkeleton } from "@/components/customer/ui/mafood-states";

export default function MarketplaceLoading() {
  return (
    <div className="min-h-dvh-100 px-4 pt-6">
      <div className="h-3 w-40 rounded-full bg-mafood-background-soft animate-pulse" />
      <div className="mt-4 h-10 w-3/4 rounded-full bg-mafood-background-soft animate-pulse" />
      <div className="mt-3 h-4 w-full max-w-md rounded-full bg-mafood-background-soft animate-pulse" />
      <div className="mt-8 flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[88px] w-[140px] shrink-0 rounded-mafood-md bg-mafood-background-soft animate-pulse"
          />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <LoadingSkeleton key={i} variant="card" />
        ))}
      </div>
    </div>
  );
}
