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
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        blue: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
        red: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        'obsidian': '#0f172a',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        'neon-emerald': '0 0 15px rgba(16, 185, 129, 0.5)',
        'neon-blue': '0 0 15px rgba(59, 130, 246, 0.5)',
        'neon-red': '0 0 15px rgba(239, 68, 68, 0.5)',
        'neon-amber': '0 0 15px rgba(245, 158, 11, 0.5)',
        'inner-glow': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.1)',
        '3d-board': '0 20px 40px -10px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
      },
      animation: {
        'blob': 'blob 7s infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
        pill: '9999px',
      }
    },
  },
  plugins: [],
}
