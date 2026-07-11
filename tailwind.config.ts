import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#003E7E",
        secondary: "#1E7E34",
        success: "#1E7E34",
        warning: "#D97706",
        danger: "#B91C1C",
        neutralLight: "#F8FAFC",
        neutralDark: "#334155",
        ink: "#0F172A",
        inkSoft: "#475569",
        borderMuted: "#E2E8F0",
        hoverSurface: "#F1F5F9",
        disabledSurface: "#CBD5E1",
        surface: "#FFFFFF",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Noto Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "0.15rem",
      },
    },
  },
  plugins: [],
};
export default config;
