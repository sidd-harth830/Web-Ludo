/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'ludo-emerald': '#10b981',
        'ludo-blue': '#3b82f6',
        'ludo-red': '#ef4444',
        'ludo-amber': '#f59e0b',
        'obsidian': '#0f172a',
      },
    },
  },
  plugins: [],
}
