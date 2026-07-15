import { AdminShell } from "@/components/admin/admin-shell";
import { adminMono, adminSans } from "@/lib/fonts/admin";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${adminSans.variable} ${adminMono.variable}`}>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
