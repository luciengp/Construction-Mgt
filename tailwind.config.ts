import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        navy: {
          DEFAULT: "#1F3864",
          light: "#2B4A80",
          dark: "#16294A",
        },
        gold: {
          DEFAULT: "#BF9000",
          light: "#D9A600",
        },
        status: {
          pass: "#1E8E3E",
          warn: "#F9AB00",
          fail: "#D93025",
        },
      },
    },
  },
  plugins: [],
};
export default config;
