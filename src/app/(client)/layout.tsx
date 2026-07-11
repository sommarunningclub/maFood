import { Providers } from "@/components/providers";
import { CustomerBottomNav } from "@/components/customer/bottom-nav";
import { merriweather, dmSans } from "@/lib/fonts";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className={`mafood-shell ${merriweather.variable} ${dmSans.variable} min-h-dvh-100 flex flex-col`}>
        <div className="mx-auto w-full max-w-screen-mobile lg:max-w-3xl flex-1 pb-[72px]">
          {children}
        </div>
        <div className="fixed bottom-0 inset-x-0 z-40 mx-auto max-w-screen-mobile lg:max-w-3xl bg-mafood-surface-strong/95 backdrop-blur border-t border-mafood-border pb-safe">
          <CustomerBottomNav />
        </div>
      </div>
    </Providers>
  );
}
