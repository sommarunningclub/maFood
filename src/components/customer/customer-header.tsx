"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CustomerSession } from "@/lib/auth/customer-session";

export function CustomerHeader({
  session,
  venue,
}: {
  session: CustomerSession | null;
  venue: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/customer/logout", { method: "POST" });
    router.push(`/${venue}/login`);
    router.refresh();
  }

  if (!session) return null;

  const first = session.name.split(" ")[0];

  return (
    <div className="sticky top-0 z-30 bg-mafood-background/95 backdrop-blur border-b border-mafood-border px-5 py-2 pt-safe flex items-center justify-between min-h-touch">
      <div className="flex items-center gap-2 min-w-0">
        <span className="num text-[11px] text-mafood-text-secondary">Olá,</span>
        <span className="text-mafood-text-primary text-sm font-medium truncate">{first}</span>
        {session.is_vip && (
          <span className="num text-[9px] uppercase bg-mafood-primary/15 text-mafood-primary px-1.5 py-0.5 rounded">
            VIP
          </span>
        )}
      </div>
      <button
        onClick={logout}
        disabled={loading}
        className="num text-[10px] uppercase text-mafood-text-secondary hover:text-mafood-primary disabled:opacity-50 min-h-touch px-2 focus-ring"
      >
        {loading ? "..." : "Sair"}
      </button>
    </div>
  );
}
