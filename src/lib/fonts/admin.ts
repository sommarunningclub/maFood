import { Inter, JetBrains_Mono } from "next/font/google";

export const adminSans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const adminMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
