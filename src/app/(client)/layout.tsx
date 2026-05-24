import { Providers } from "@/components/providers";

/*
  Cliente é mobile-first PWA.
  - min-h-dvh-100 respeita altura real (sem barra do navegador)
  - safe-area no padding-bottom (home indicator iOS)
  - max-w-screen-mobile centraliza em tablet/desktop (evita texto esticado);
    páginas individuais podem sobrescrever para hero/full-bleed.
*/
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="theme-client min-h-dvh-100 somma-grain">
        <div className="mx-auto w-full max-w-screen-mobile">{children}</div>
      </div>
    </Providers>
  );
}
