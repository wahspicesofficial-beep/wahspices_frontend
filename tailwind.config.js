/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#1a5c2e',
          'green-light': '#2d8a4e',
          'green-dark': '#0f3d1e',
          red: '#c8371e',
          'red-light': '#e04a2f',
          orange: '#f5a623',
          'orange-light': '#f8bc55',
          cream: '#fff9f0',
          'cream-dark': '#f5e8d0',
          brown: '#6b3c2a',
          gold: '#d4a017',
        },
      },
      fontFamily: {
        /* font-heading now = Poppins (clean, readable, consistent with brand) */
        heading: ['Poppins', 'system-ui', 'sans-serif'],
        /* font-body  = Poppins */
        body: ['Poppins', 'system-ui', 'sans-serif'],
        /* font-accent = Dancing Script — ONLY for decorative taglines */
        accent: ['Dancing Script', 'cursive'],
        /* keep serif available if needed for editorial content */
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.6s ease-out forwards',
        'slide-in-right': 'slideInRight 0.6s ease-out forwards',
        'scale-in': 'scaleIn 0.4s ease-out forwards',
        'float': 'float 3s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'bounce-slow': 'bounce 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-40px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(40px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.9)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
      backgroundImage: {
        'spice-pattern': "url('/patterns/spice-bg.svg')",
        'hero-gradient': 'linear-gradient(135deg, #1a5c2e 0%, #2d8a4e 50%, #f5a623 100%)',
        'card-gradient': 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)',
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.15)',
        'brand': '0 4px 20px rgba(26,92,46,0.3)',
        'brand-hover': '0 8px 40px rgba(26,92,46,0.4)',
      },
    },
  },
  plugins: [],
};
