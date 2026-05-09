import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pomie: {
          50: "#fdf6f0",
          100: "#f9e6d6",
          200: "#f1c7a3",
          400: "#d68a55",
          500: "#c97539",
          600: "#a85d27",
          700: "#7e441c",
          900: "#3a1f0c",
        },
        ink: {
          900: "#1a1a1a",
          700: "#3d3d3d",
          500: "#6b6b6b",
          300: "#b5b5b5",
          100: "#ececec",
        },
      },
      fontFamily: {
        sans: ["'Hiragino Sans'", "'Yu Gothic'", "Meiryo", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
