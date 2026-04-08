/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0F",
        surface: "#13131A",
        border: "#27272F",
        accent: "#A3E635",
        danger: "#F43F5E",
        purple: "#A855F7",
        pink: "#EC4899",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
