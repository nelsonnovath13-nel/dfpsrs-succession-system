import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0F3D66",
        secondary: "#1E5631",
        neutralLight: "#F2F3F4",
        neutralDark: "#3A3A3A",
        surface: "#FFFFFF",
      },
      borderRadius: {
        sm: "0.15rem",
      },
    },
  },
  plugins: [],
};
export default config;
