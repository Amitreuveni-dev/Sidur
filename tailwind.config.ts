import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        rubik: ["Rubik", "sans-serif"],
      },
      colors: {
        shift: {
          morning: "#EFF6FF",   // Light Blue bg
          morningText: "#1D4ED8",
          afternoon: "#FEF9C3", // Amber bg
          afternoonText: "#A16207",
          night: "#EDE9FE",     // Purple bg
          nightText: "#6D28D9",
          rest: "#F0FDF4",      // Green bg
          restText: "#15803D",
        },
      },
    },
  },
  plugins: [],
};
export default config;
