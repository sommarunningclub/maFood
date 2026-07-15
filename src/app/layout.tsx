import type { Metadata, Viewport } from "next";
import "./globals.css";

const APP_NAME = "SommaFood";
const APP_DESC = "Praça de alimentação digital · Somma Special Day";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: `${APP_NAME} — Somma Special Day`, template: `%s · ${APP_NAME}` },
  description: APP_DESC,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.svg" }],
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — Somma Special Day`,
    description: APP_DESC,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#080808" },
    { media: "(prefers-color-scheme: dark)", color: "#080808" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" dir="ltr">
      <body className="antialiased min-h-[100dvh] bg-somma-bg text-somma-text">
        {children}
      </body>
    </html>
  );
}
