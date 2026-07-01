import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const THEMES = ["workstation-dark", "workstation-light", "quartz", "sanzo"] as const;
export type Theme = (typeof THEMES)[number];

const KEY = "hermetika-theme";

const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "workstation-dark",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(KEY) as Theme | null;
    return saved && THEMES.includes(saved) ? saved : "workstation-dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
