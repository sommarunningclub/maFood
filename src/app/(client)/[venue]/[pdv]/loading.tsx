import { LoadingSkeleton } from "@/components/customer/ui/mafood-states";

export default function MenuLoading() {
  return (
    <div className="min-h-dvh-100">
      <div className="mafood-header-gradient pt-safe px-4 pb-8 pt-3">
        <div className="size-11 rounded-mafood-md bg-white/20 animate-pulse" />
        <div className="mt-4 flex items-end gap-4">
          <div className="size-16 rounded-mafood-lg bg-white/20 animate-pulse" />
          <div className="flex-1 space-y-2 pb-1">
            <div className="h-7 w-2/3 rounded-full bg-white/25 animate-pulse" />
            <div className="h-4 w-1/2 rounded-full bg-white/20 animate-pulse" />
          </div>
        </div>
      </div>
      <div className="space-y-3 px-4 pt-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <LoadingSkeleton key={i} variant="row" />
        ))}
      </div>
    </div>
  );
}
