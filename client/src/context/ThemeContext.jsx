import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('wave_theme') || 'dark');
  // Independent of light/dark: swaps the blue accent for a grayscale one,
  // mirroring the "Монохром" option in the native apps' theme switcher.
  const [accent, setAccent] = useState(() => localStorage.getItem('wave_accent') || 'colorful');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wave_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem('wave_accent', accent);
  }, [accent]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const toggleAccent = () => setAccent((a) => (a === 'mono' ? 'colorful' : 'mono'));

  return (
    <ThemeContext.Provider value={{ theme, toggle, accent, toggleAccent }}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
