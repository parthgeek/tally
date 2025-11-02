"use client";

import * as React from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
};

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState);

/**
 * Theme provider that forces dark mode
 * Light mode has been removed - app is dark-only
 */
export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "nexus-ui-theme",
  ...props
}: ThemeProviderProps) {
  // Always use dark theme, ignore localStorage and system preferences
  const theme: Theme = "dark";

  React.useEffect(() => {
    const root = window.document.documentElement;
    
    // Always apply dark class
    root.classList.remove("light", "dark");
    root.classList.add("dark");
    
    // Clear any old light mode preference from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey);
      if (stored && stored !== "dark") {
        localStorage.setItem(storageKey, "dark");
      }
    }
  }, [storageKey]);

  const value = {
    theme: "dark" as Theme,
    setTheme: () => {
      // No-op: theme is always dark
      console.warn("Theme switching is disabled. App is dark-only.");
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext);

  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
