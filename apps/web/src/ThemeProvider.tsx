import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const THEMES = ["sanzo-ember", "sanzo-rose", "sanzo-indigo", "sanzo-slate", "sanzo-forest", "quartz"] as const;
export type Theme = (typeof THEMES)[number];

const T_KEY = "hermetika-theme";

const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme: "sanzo-ember", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const s = localStorage.getItem(T_KEY) as Theme | null;
    return s && THEMES.includes(s) ? s : "sanzo-ember";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(T_KEY, theme);
  }, [theme]);

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
