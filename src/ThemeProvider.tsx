"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { defaultTheme, isTheme, themeCookie, type ThemeId } from "./themes";

type Appearance = {
  theme: ThemeId;
  preferred: ThemeId | null;
  siteTheme: ThemeId;
  choose: (theme: ThemeId | null) => void;
  setSiteTheme: (theme: unknown) => void;
};
const ThemeContext = createContext<Appearance | null>(null);
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeProvider is required");
  return context;
}

export default function ThemeProvider({
  children,
  initialTheme,
  preference,
}: {
  children: ReactNode;
  initialTheme: ThemeId;
  preference: ThemeId | null;
}) {
  const [siteTheme, setDefault] = useState(initialTheme);
  const [preferred, setPreferred] = useState(preference);
  const theme = preferred || siteTheme;
  const setSiteTheme = useCallback(
    (value: unknown) => setDefault(isTheme(value) ? value : defaultTheme),
    [],
  );
  const choose = useCallback((value: ThemeId | null) => {
    setPreferred(value);
    document.cookie = `${themeCookie}=${value || ""}; Path=/; Max-Age=${value ? 31536000 : 0}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme =
      theme === "noir" ? "dark" : "light";
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue("--paper")
      .trim();
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", color);
    document
      .querySelector('meta[name="color-scheme"]')
      ?.setAttribute("content", theme === "noir" ? "dark" : "light");
  }, [theme]);
  return (
    <ThemeContext.Provider
      value={{ theme, preferred, siteTheme, choose, setSiteTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
