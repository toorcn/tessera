import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F4F1EA",
        "paper-deep": "#EAE5D9",
        ink: "#1A1A1A",
        "ink-soft": "#4A4843",
        clay: "#C75B39",
        "clay-deep": "#A8472B",
        line: "#D8D2C4",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Hanken Grotesk", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(26,26,26,0.06), 0 8px 24px rgba(26,26,26,0.06)",
        tile: "0 1px 0 rgba(26,26,26,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
