import type { Metadata, Viewport } from "next";
import {
  CustomerBottomNav,
  CustomerMain,
} from "@/components/customer/bottom-nav";
import {
  clientDisplay,
  clientMono,
  clientSans,
  dmSans,
  merriweather,
} from "@/lib/fonts/client";

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SommaFood",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf3ea",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`mafood-shell ${clientDisplay.variable} ${clientSans.variable} ${clientMono.variable} ${merriweather.variable} ${dmSans.variable} min-h-dvh-100 flex flex-col`}
    >
      <CustomerMain>{children}</CustomerMain>
      <CustomerBottomNav />
    </div>
  );
}
