import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palantir — Admin / PDV (terminal operacional)
        palantir: {
          bg: "#0A0C10",
          surface: "#161B22",
          surface2: "#1C2128",
          border: "#30363D",
          text: "#C9D1D9",
          muted: "#8B949E",
          red: "#F85149",
          green: "#3FB950",
          blue: "#58A6FF",
          yellow: "#D29922",
        },
        // Somma — Cliente (editorial esportivo)
        somma: {
          bg: "#080808",
          surface: "#141414",
          surface2: "#1A1A1A",
          border: "#2A2A2A",
          orange: "#F26522",
          "orange-dark": "#D4501A",
          text: "#F0F0F0",
          muted: "#A0A0A0",
          red: "#FF4D4D",
          green: "#3FB950",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        display: ["var(--font-barlow)", "sans-serif"],
        body: ["var(--font-jakarta)", "sans-serif"],
        num: ["var(--font-plex-mono)", "monospace"],
      },
      height: { "13": "3.25rem" },
      borderRadius: {
        admin: "0px",
        client: "6px",
      },
      keyframes: {
        "pulse-orange": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(242,101,34,0.6)" },
          "50%": { boxShadow: "0 0 0 12px rgba(242,101,34,0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-orange": "pulse-orange 1.6s infinite",
        "slide-in": "slide-in 0.25s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
