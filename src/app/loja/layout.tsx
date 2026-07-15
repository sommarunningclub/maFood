import { adminMono, adminSans } from "@/lib/fonts/admin";

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${adminSans.variable} ${adminMono.variable}`}>{children}</div>
  );
}
