import { adminMono, adminSans } from "@/lib/fonts/admin";

export default function PdvLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${adminSans.variable} ${adminMono.variable} theme-admin min-h-screen`}
    >
      {children}
    </div>
  );
}
