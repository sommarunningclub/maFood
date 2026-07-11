import { Providers } from "@/components/providers";
import { CustomerBottomNav } from "@/components/customer/bottom-nav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="theme-client min-h-dvh-100 somma-grain flex flex-col">
        <div className="mx-auto w-full max-w-screen-mobile flex-1 pb-[72px]">
          {children}
        </div>
        {/* Bottom nav fixo acima do safe-area; oculto em checkout/login/order */}
        <div className="fixed bottom-0 inset-x-0 z-40 mx-auto max-w-screen-mobile bg-[rgba(8,8,8,0.94)] backdrop-blur border-t border-white/[0.07] pb-safe">
          <CustomerBottomNav />
        </div>
      </div>
    </Providers>
  );
}
