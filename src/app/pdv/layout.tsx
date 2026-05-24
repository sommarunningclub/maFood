import { Providers } from "@/components/providers";

export default function PdvLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="theme-admin min-h-screen">{children}</div>
    </Providers>
  );
}
