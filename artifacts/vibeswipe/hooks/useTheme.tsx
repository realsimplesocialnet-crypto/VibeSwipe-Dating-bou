import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type ColorScheme = "dark" | "light";
type ThemeContextValue = {
  scheme: ColorScheme;
  setScheme: (scheme: ColorScheme) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  scheme: "light",
  setScheme: async () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>("light");
  useEffect(() => {
    void AsyncStorage.getItem("vibeswipe-color-scheme").then((saved) => {
      if (saved === "light" || saved === "dark") setSchemeState(saved);
    });
  }, []);
  const value = useMemo(
    () => ({
      scheme,
      setScheme: async (next: ColorScheme) => {
        setSchemeState(next);
        await AsyncStorage.setItem("vibeswipe-color-scheme", next);
      },
    }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
