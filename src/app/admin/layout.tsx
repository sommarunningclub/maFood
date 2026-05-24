import Link from "next/link";
import { Providers } from "@/components/providers";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "▦" },
  { href: "/admin/orders", label: "Pedidos", icon: "▤" },
  { href: "/admin/pdvs", label: "PDVs", icon: "▢" },
  { href: "/admin/products", label: "Produtos", icon: "◳" },
  { href: "/admin/coupons", label: "Cupons", icon: "%" },
  { href: "/admin/financial", label: "Financeiro", icon: "$" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="theme-admin flex min-h-screen">
        <aside className="flex w-56 shrink-0 flex-col border-r border-palantir-border bg-palantir-surface">
          <div className="border-b border-palantir-border px-5 py-4">
            <h1 className="text-lg font-bold text-white">maFood</h1>
            <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
              Backoffice
            </p>
          </div>
          <nav className="flex-1 p-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-admin px-3 py-2 text-sm text-palantir-text hover:bg-palantir-surface2"
              >
                <span className="mono w-4 text-palantir-muted">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-palantir-border px-5 py-3">
            <p className="mono text-[10px] text-palantir-muted">Somma Special Day</p>
            <p className="mono text-[10px] text-palantir-green">● ONLINE</p>
          </div>
        </aside>
        <main className="palantir-grid flex-1 overflow-auto">{children}</main>
      </div>
    </Providers>
  );
}
