import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const THEMES = ["sanzo-ember", "sanzo-rose", "sanzo-indigo", "sanzo-slate", "sanzo-forest", "quartz"] as const;
export type Theme = (typeof THEMES)[number];

export const FONTS = ["departure", "nous", "taurus"] as const;
export type Font = (typeof FONTS)[number];

// old-school monos — Departure (pixel/ASCII), JetBrains (Nous terminal), Taurus.
const FONT_STACK: Record<Font, string> = {
  departure: '"Departure Mono", ui-monospace, monospace',
  nous: '"JetBrains Mono", ui-monospace, monospace',
  taurus: '"Taurus Mono", ui-monospace, monospace',
};

const T_KEY = "hermetika-theme";
const F_KEY = "hermetika-font";

interface Ctx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  font: Font;
  setFont: (f: Font) => void;
}

const ThemeCtx = createContext<Ctx>({ theme: "sanzo-ember", setTheme: () => {}, font: "departure", setFont: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const s = localStorage.getItem(T_KEY) as Theme | null;
    return s && THEMES.includes(s) ? s : "sanzo-ember";
  });
  const [font, setFont] = useState<Font>(() => {
    const s = localStorage.getItem(F_KEY) as Font | null;
    return s && FONTS.includes(s) ? s : "departure";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(T_KEY, theme);
  }, [theme]);

  useEffect(() => {
    // inline override beats the per-theme --mono in the stylesheet.
    document.documentElement.style.setProperty("--mono", FONT_STACK[font]);
    localStorage.setItem(F_KEY, font);
  }, [font]);

  return <ThemeCtx.Provider value={{ theme, setTheme, font, setFont }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
