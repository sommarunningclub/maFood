import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    // Breakpoints semânticos: foco mobile-first
    // xs = phone landscape, sm = phablet, md = tablet portrait, lg = tablet landscape / small laptop, xl = desktop, 2xl = wide
    screens: {
      xs: "420px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
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
        // maFood — Cliente (light/cream, novo design system)
        mafood: {
          primary: "var(--mafood-primary)",
          "primary-dark": "var(--mafood-primary-dark)",
          "primary-light": "var(--mafood-primary-light)",
          accent: "var(--mafood-accent)",
          "accent-dark": "var(--mafood-accent-dark)",
          "accent-light": "var(--mafood-accent-light)",
          gold: "var(--mafood-gold)",
          success: "var(--mafood-success)",
          "success-bright": "var(--mafood-success-bright)",
          "success-strong": "var(--mafood-success-strong)",
          "section-title": "var(--mafood-section-title)",
          background: "var(--mafood-background)",
          "background-soft": "var(--mafood-background-soft)",
          "background-warm": "var(--mafood-background-warm)",
          surface: "var(--mafood-surface)",
          "surface-strong": "var(--mafood-surface-strong)",
          "text-primary": "var(--mafood-text-primary)",
          "text-secondary": "var(--mafood-text-secondary)",
          "text-muted": "var(--mafood-text-muted)",
          border: "var(--mafood-border)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        display: ["var(--font-barlow)", "sans-serif"],
        body: ["var(--font-jakarta)", "sans-serif"],
        num: ["var(--font-plex-mono)", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        dmsans: ["var(--font-dmsans)", "system-ui", "sans-serif"],
      },
      // Tipografia fluida com clamp() — escala suave do mobile ao desktop
      fontSize: {
        "fluid-xs": "clamp(0.6875rem, 0.65rem + 0.18vw, 0.75rem)",
        "fluid-sm": "clamp(0.8125rem, 0.78rem + 0.18vw, 0.875rem)",
        "fluid-base": "clamp(0.9375rem, 0.9rem + 0.2vw, 1rem)",
        "fluid-lg": "clamp(1.0625rem, 1rem + 0.3vw, 1.125rem)",
        "fluid-xl": "clamp(1.1875rem, 1.1rem + 0.4vw, 1.375rem)",
        "fluid-2xl": "clamp(1.5rem, 1.3rem + 1vw, 2rem)",
        "fluid-3xl": "clamp(1.875rem, 1.5rem + 1.8vw, 2.75rem)",
        "fluid-4xl": "clamp(2.25rem, 1.8rem + 2.4vw, 3.5rem)",
        "fluid-5xl": "clamp(2.75rem, 2rem + 3.5vw, 4.5rem)",
      },
      spacing: {
        // safe-area iOS (notch/home indicator)
        "safe-t": "env(safe-area-inset-top)",
        "safe-b": "env(safe-area-inset-bottom)",
        "safe-l": "env(safe-area-inset-left)",
        "safe-r": "env(safe-area-inset-right)",
        // touch target mínimo (Apple HIG / WCAG AAA)
        touch: "44px",
      },
      minHeight: {
        touch: "44px",
        "dvh-100": "100dvh",
        "svh-100": "100svh",
      },
      minWidth: {
        touch: "44px",
      },
      height: {
        "13": "3.25rem",
        "dvh-100": "100dvh",
        "svh-100": "100svh",
      },
      maxWidth: {
        "screen-mobile": "26rem", // 416px — limite confortável para mobile centralizado
      },
      boxShadow: {
        "mafood-sm": "var(--mafood-shadow-sm)",
        "mafood-md": "var(--mafood-shadow-md)",
        "mafood-lg": "var(--mafood-shadow-lg)",
      },
      borderRadius: {
        admin: "0px",
        client: "6px",
        "mafood-sm": "var(--mafood-radius-sm)",
        "mafood-md": "var(--mafood-radius-md)",
        "mafood-lg": "var(--mafood-radius-lg)",
        "mafood-xl": "var(--mafood-radius-xl)",
      },
      keyframes: {
        "pulse-orange": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(242,101,34,0.6)" },
          "50%": { boxShadow: "0 0 0 12px rgba(242,101,34,0)" },
        },
        "pulse-primary": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(14,91,86,0.6)" },
          "50%": { boxShadow: "0 0 0 12px rgba(14,91,86,0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(100%)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "pulse-orange": "pulse-orange 1.6s infinite",
        "pulse-primary": "pulse-primary 1.6s infinite",
        "slide-in": "slide-in 0.25s ease-out",
        "slide-in-right": "slide-in-right 0.25s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
