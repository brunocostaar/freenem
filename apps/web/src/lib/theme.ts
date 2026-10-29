import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
const KEY = 'freenem-theme';

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* storage indisponível */
  }
  return 'system';
}

function apply(choice: ThemeChoice) {
  const el = document.documentElement;
  if (choice === 'system') delete el.dataset.theme;
  else el.dataset.theme = choice;
}

/** Alterna claro/escuro; 'system' segue prefers-color-scheme. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read);

  useEffect(() => {
    apply(choice);
  }, [choice]);

  const resolved: 'light' | 'dark' =
    choice === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : choice;

  const toggle = useCallback(() => {
    const next: ThemeChoice = resolved === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    setChoice(next);
  }, [resolved]);

  return { choice, resolved, toggle };
}
