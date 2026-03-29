/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef3ff',
          100: '#dde7ff',
          200: '#b3c8ff',
          300: '#85a5ff',
          400: '#5c84ff',
          500: '#3d6bff',
          600: '#2750e0',
          700: '#1c3ab8',
          800: '#162e93',
          900: '#0f1f6b',
        },
        // Premium zinc-based surface system
        surface: {
          950: '#09090B',
          900: '#111113',
          850: '#161618',
          800: '#1C1C1F',
          750: '#222226',
          700: '#28282D',
          600: '#3D3D44',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.02em',
      },
      animation: {
        'fade-in': 'fadeIn .2s ease',
        'slide-up': 'slideUp .25s cubic-bezier(.22,1,.36,1)',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
      },
    },
  },
  plugins: [],
}
