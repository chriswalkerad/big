"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

/**
 * App-wide theme provider. Uses next-themes with the `class` strategy so a
 * `.dark` class is toggled on <html>, matching the tokens defined in
 * src/styles/tokens.css. Defaults to the system preference and persists the
 * user's choice automatically.
 *
 * `disableTransitionOnChange` is intentionally NOT set: next-themes would
 * otherwise inject `transition: none !important` during the class swap, which
 * snaps the colors. Leaving it off lets the global color transition in
 * globals.css ease the light↔dark switch (the class is still set pre-paint by
 * next-themes' inline script, so there is no load flash).
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
