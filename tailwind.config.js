/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        canvas: 'var(--bg-canvas)',
        'canvas-soft': 'var(--bg-canvas-soft)',
        'surface-card': 'var(--surface-card)',
        'surface-strong': 'var(--surface-strong)',
        'surface-dark': 'var(--surface-dark)',
        primary: 'var(--primary)',
        'primary-active': 'var(--primary-active)',
        ink: 'var(--ink)',
        body: 'var(--body)',
        muted: 'var(--muted)',
        hairline: 'var(--hairline)',
        'hairline-strong': 'var(--hairline-strong)',
        'text-link': 'var(--text-link)',
        'on-primary': 'var(--on-primary)',
        'on-dark': 'var(--on-dark)',
        'ludo-emerald': '#10b981',
        'ludo-blue': '#3b82f6',
        'ludo-red': '#ef4444',
        'ludo-amber': '#f59e0b',
        'obsidian': '#0f172a',
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
        xl: '16px',
        pill: '9999px',
      }
    },
  },
  plugins: [],
}
