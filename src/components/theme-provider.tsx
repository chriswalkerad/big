"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

/**
 * App-wide theme provider. Uses next-themes with the `class` strategy so a
 * `.dark` class is toggled on <html>, matching the tokens defined in
 * src/styles/tokens.css. Defaults to the system preference and persists the
 * user's choice automatically.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
