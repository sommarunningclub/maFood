import type { Metadata, Viewport } from "next";
import {
  Inter,
  Barlow_Condensed,
  Plus_Jakarta_Sans,
  IBM_Plex_Mono,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow",
});
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "maFood — Somma Special Day",
  description: "Praça de alimentação digital · Somma Special Day",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body
        className={`${inter.variable} ${jetbrains.variable} ${barlow.variable} ${jakarta.variable} ${plex.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
