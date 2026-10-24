/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        panel2: 'var(--panel2)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        accent2: 'var(--accent-2)',
        accentFill: 'var(--accent-fill)',
        rail: 'var(--rail)',
        online: 'var(--online)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        hover: 'var(--hover)',
        selected: 'var(--selected)',
      },
    },
  },
  plugins: [],
};
