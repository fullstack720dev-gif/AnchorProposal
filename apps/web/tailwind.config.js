/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          light: 'var(--primary-light)',
          deep: 'var(--primary-deep)',
          muted: 'var(--primary-muted)',
        },
        accent: 'var(--accent)',
        surface: {
          DEFAULT: 'var(--surface)',
          muted: 'var(--surface-muted)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      keyframes: {
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'spin-rev': {
          to: { transform: 'rotate(-360deg)' },
        },
        'auth-rise': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'auth-fade': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'auth-drift': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1.05)' },
          '50%': { transform: 'translate3d(-1.5%, 1%, 0) scale(1.08)' },
        },
      },
      animation: {
        'spin-slow': 'spin-slow 1.4s linear infinite',
        'spin-rev': 'spin-rev 2s linear infinite',
        'auth-rise': 'auth-rise 0.55s ease-out both',
        'auth-fade': 'auth-fade 0.8s ease-out both',
        'auth-drift': 'auth-drift 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
