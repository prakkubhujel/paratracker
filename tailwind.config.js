/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand — teal, altitude/sky. Replaces stock `blue` as the
        // primary accent across the app. See ../DESIGN-DIRECTION.md.
        brand: {
          50: '#E1F5EE',
          100: '#9FE1CB',
          200: '#5DCAA5',
          300: '#3BB48C',
          400: '#1D9E75',
          500: '#158562',
          600: '#0F6E56',
          700: '#0C5B47',
          800: '#085041',
          900: '#04342C',
        },
        // Coral — the one warm accent, for "worth noting" states that
        // aren't full alerts. Never used for danger (that stays red).
        coral: {
          50: '#FAECE7',
          100: '#F5C4B3',
          200: '#F0997B',
          300: '#E37750',
          400: '#D85A30',
          500: '#B84826',
          600: '#993C1D',
          700: '#832F17',
          800: '#712B13',
          900: '#4A1B0C',
        },
      },
    },
  },
  plugins: [],
};
