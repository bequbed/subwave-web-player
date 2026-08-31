// Light/dark theme. Three-way model: a saved 'light'/'dark' choice wins, no
// choice follows the OS. The data-theme attribute on <html> is the single
// switch the CSS reads; index.html's inline script sets it before first paint
// (no flash), so this hook only ever CHANGES it afterwards.
import { useCallback, useEffect, useState } from 'react';

const KEY = 'subwave-theme';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

function resolve(): ResolvedTheme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* private mode — fall through to OS preference */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ResolvedTheme>(() => resolve());

  // Follow the OS live while the user hasn't pinned a choice.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      try {
        if (localStorage.getItem(KEY)) return;
      } catch {
        /* treat as unpinned */
      }
      const next = resolve();
      apply(next);
      setThemeState(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((choice: ThemeChoice) => {
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      /* unpersistent — still apply for this visit */
    }
    const next = resolve();
    apply(next);
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}
