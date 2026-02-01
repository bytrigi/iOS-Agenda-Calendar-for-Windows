/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", /* <--- ESTO ES IMPORTANTE */
  ],
  theme: {
    extend: {
      colors: {
        'ios-bg': '#F2F2F7',
        'ios-surface': '#FFFFFF',
        'ios-blue': '#007AFF',
        'ios-red': '#FF3B30',
        'ios-gray-text': '#8E8E93',
        'ios-line': '#E5E5EA',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}