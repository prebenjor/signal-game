/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      colors: {
        bg: "#05080d",
        panel: "#0c1220",
        panel2: "#0f1626",
        text: "#e9f0ff",
        muted: "#9fb0c6",
        accent: "#ff9c3a",
        accent2: "#2dd4bf",
        border: "rgba(255,255,255,0.08)",
      },
      boxShadow: {
        panel: "0 18px 34px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
