import {
  Barlow_Condensed,
  DM_Sans,
  IBM_Plex_Mono,
  Merriweather,
  Plus_Jakarta_Sans,
} from "next/font/google";

export const clientDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

export const clientSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const clientMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dmsans",
  display: "swap",
});
