import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Velvet night — ink with a violet undertone. Never pure black.
        ink: {
          950: "#0b0a0e",
          900: "#0f0e14",
          800: "#16141d",
          700: "#1d1a26",
        },
        // Warm ivory — never pure white.
        ivory: {
          DEFAULT: "#efece6",
          dim: "#a29da8",
          faint: "#6b6672",
        },
        // The one precious accent: champagne gold.
        gold: {
          DEFAULT: "#e2b65b",
          soft: "#d4aa54",
        },
        // Data-semantic only (market falling). Muted, never decorative.
        rose: "#c97a6f",
      },
      fontFamily: {
        display: ["var(--font-serif)", "Georgia", "serif"],
        num: ["var(--font-num)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.35", transform: "scale(1.5)" },
        },
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
        riseIn: "riseIn 0.5s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
