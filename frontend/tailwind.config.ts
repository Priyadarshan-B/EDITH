import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#080c14",
        card: "#0d131f",
        cardMuted: "#111a2d",
        border: "#1e293b",
        hudCyan: {
          DEFAULT: "#00f0ff",
          glow: "rgba(0, 240, 255, 0.4)",
          dim: "#008a99",
        },
        hudBlue: {
          DEFAULT: "#0072ff",
          glow: "rgba(0, 114, 255, 0.4)",
        },
        hudOrange: {
          DEFAULT: "#ff9100",
          glow: "rgba(255, 145, 0, 0.4)",
        },
        hudRed: {
          DEFAULT: "#ff2a55",
          glow: "rgba(255, 42, 85, 0.4)",
        },
      },
      fontFamily: {
        mono: ["Consolas", "Courier New", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        hud: "0 0 15px rgba(0, 240, 255, 0.2)",
        hudStrong: "0 0 25px rgba(0, 240, 255, 0.45)",
        hudDanger: "0 0 20px rgba(255, 42, 85, 0.4)",
      },
      animation: {
        pulseGlow: "pulseGlow 2s infinite ease-in-out",
        wave: "wave 1.2s infinite ease-in-out",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        wave: {
          "0%, 100%": { height: "6px" },
          "50%": { height: "24px" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

