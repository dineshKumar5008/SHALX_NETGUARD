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
        soc: {
          bg: '#f8fafc',
          canvas: '#f8fafc',
          surface: '#ffffff',
          surfaceHover: '#f1f5f9',
          surfaceRaised: '#ffffff',
          border: '#e2e8f0',
          borderSubtle: '#f1f5f9',
          borderLight: '#cbd5e1',
          primary: '#2563eb',
          primaryHover: '#1d4ed8',
          accent: '#0284c7',
          cyan: '#0284c7',
          emerald: '#059669',
          amber: '#d97706',
          rose: '#dc2626',
          text: '#0f172a',
          muted: '#64748b',
          faint: '#94a3b8',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Menlo', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
