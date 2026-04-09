"use client";

import * as React from "react";

const STORAGE_KEY = "theme";

export type ThemeContextValue = {
  theme: string;
  setTheme: (theme: string) => void;
  resolvedTheme: "light" | "dark" | undefined;
  themes: string[];
  systemTheme?: "light" | "dark";
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

type ThemeProviderProps = React.PropsWithChildren<{
  defaultTheme?: string;
  enableSystem?: boolean;
  attribute?: "class";
  disableTransitionOnChange?: boolean;
}>;

function applyNoTransition() {
  const el = document.createElement("style");
  el.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}"
    )
  );
  document.head.appendChild(el);
  window.getComputedStyle(document.body);
  setTimeout(() => document.head.removeChild(el), 1);
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState(defaultTheme);
  const [systemTheme, setSystemTheme] = React.useState<"light" | "dark">("light");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setThemeState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const resolvedTheme: "light" | "dark" | undefined =
    !mounted ? undefined : theme === "system" && enableSystem ? systemTheme : theme === "dark" ? "dark" : "light";

  React.useEffect(() => {
    if (!mounted || !resolvedTheme) return;
    if (disableTransitionOnChange) applyNoTransition();
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [mounted, resolvedTheme, disableTransitionOnChange]);

  const setTheme = React.useCallback((next: string) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      themes: enableSystem ? ["light", "dark", "system"] : ["light", "dark"],
      systemTheme,
    }),
    [theme, setTheme, resolvedTheme, enableSystem, systemTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
