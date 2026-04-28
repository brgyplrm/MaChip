
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'bell-shake': {
          '0%': { transform: 'rotate(0)' },
          '15%': { transform: 'rotate(10deg)' },
          '30%': { transform: 'rotate(-10deg)' },
          '45%': { transform: 'rotate(5deg)' },
          '60%': { transform: 'rotate(-5deg)' },
          '100%': { transform: 'rotate(0)' },
        },
      },
      animation: {
        'bell-shake': 'bell-shake 0.5s ease',
      }
    },
  },
  plugins: [],
}
