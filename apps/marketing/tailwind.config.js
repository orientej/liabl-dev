/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@liabl/ui/tailwind-preset')],
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/**/*.{js,ts,jsx,tsx}',
  ],
  plugins: [],
}
