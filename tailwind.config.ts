import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
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
        warm: {
          50:  '#fdf8f0',  // card bg (replaces white)
          100: '#f5efe6',  // page bg (replaces slate-50)
          200: '#ede8df',  // input/row bg (replaces slate-100)
          300: '#d4cec6',  // handles/borders
        },
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
