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
        // Arcade Neon Yellow & Dark Surfaces (Reference Design)
        neon: {
          DEFAULT: '#E8FF00',
          yellow: '#E8FF00',
          lime: '#D2F800',
          glow: 'rgba(232, 255, 0, 0.45)',
          muted: '#C2D900',
          dark: '#161900',
        },
        dark: {
          bg: '#080808',
          surface: '#0F0F0F',
          card: '#141414',
          'card-hover': '#1C1C1C',
          border: 'rgba(255, 255, 255, 0.09)',
          'border-strong': 'rgba(255, 255, 255, 0.18)',
        },
        // Legacy palette support
        glin: {
          950: '#080808',
          900: '#0C0C0C',
          850: '#121212',
          800: '#161616',
          700: '#202020',
          border: 'rgba(255, 255, 255, 0.09)',
          'border-strong': 'rgba(255, 255, 255, 0.18)',
          'refraction': 'rgba(255, 255, 255, 0.35)',
        },
        // Accents with liquid translucency
        accent: {
          neon: '#E8FF00',
          cyan: '#06b6d4',
          indigo: '#6366f1',
          purple: '#a855f7',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
        },
        slate: {
          950: '#080808',
          900: '#0C0C0C',
          850: '#121212',
          800: '#161616',
        },
      },
      fontFamily: {
        arcade: ['Oxanium', 'Outfit', 'sans-serif'],
        tech: ['Oxanium', 'Space Grotesk', 'monospace'],
        display: ['Oxanium', 'Outfit', 'sans-serif'],
        heading: ['Oxanium', 'Outfit', 'sans-serif'],
        sans: ['Inter', 'Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Oxanium', 'Space Grotesk', 'monospace'],
      },
      backdropBlur: {
        'glass-sm': '8px',
        'glass-md': '16px',
        'glass-lg': '24px',
        'glass-xl': '40px',
      },
      boxShadow: {
        'neon': '0 0 20px rgba(232, 255, 0, 0.45), 0 0 40px rgba(232, 255, 0, 0.15)',
        'neon-sm': '0 0 10px rgba(232, 255, 0, 0.35)',
        'neon-lg': '0 0 30px rgba(232, 255, 0, 0.6), 0 0 60px rgba(232, 255, 0, 0.25)',
        'dark-card': '0 10px 30px -5px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.07)',
        'glass-sm': '0 2px 8px rgba(0, 0, 0, 0.5)',
        'glass-md': '0 8px 24px rgba(0, 0, 0, 0.6), 0 2px 4px rgba(0, 0, 0, 0.3)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.4)',
        'glass-xl': '0 24px 64px rgba(0, 0, 0, 0.9), 0 8px 16px rgba(0, 0, 0, 0.5)',
        'glass-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.5)',
        'liquid-glow': '0 0 24px rgba(232, 255, 0, 0.35)',
        'liquid-emerald': '0 0 20px rgba(16, 185, 129, 0.40)',
        'liquid-amber': '0 0 20px rgba(232, 255, 0, 0.40)',
        'ball-glow': '0 8px 24px rgba(0, 0, 0, 0.8), inset 0 2px 4px rgba(255, 255, 255, 0.4), inset 0 -4px 8px rgba(0, 0, 0, 0.6)',
      },
      keyframes: {
        stampIn: {
          '0%':   { transform: 'scale(2.2) rotate(-15deg)', opacity: '0' },
          '60%':  { transform: 'scale(0.94) rotate(3deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        bounceBallDrop: {
          '0%':   { transform: 'translateY(-60px) scale(0.4)', opacity: '0' },
          '60%':  { transform: 'translateY(8px) scale(1.1)', opacity: '1' },
          '80%':  { transform: 'translateY(-4px) scale(0.96)' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        liquidPulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.85', transform: 'scale(1.02)' },
        },
        auroraDrift: {
          '0%':   { transform: 'translate(0px, 0px) scale(1)' },
          '50%':  { transform: 'translate(30px, -20px) scale(1.08)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        glassShimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'stamp':        'stampIn 0.24s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'ball-drop':    'bounceBallDrop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'liquid-pulse': 'liquidPulse 2.5s infinite ease-in-out',
        'aurora':       'auroraDrift 15s infinite alternate ease-in-out',
        'shimmer':      'glassShimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
}
