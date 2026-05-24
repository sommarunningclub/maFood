import { Providers } from "@/components/providers";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="theme-client min-h-screen somma-grain">{children}</div>
    </Providers>
  );
}
