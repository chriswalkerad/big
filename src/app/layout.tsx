import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Creative Review Workspace",
  description: "Review creative documents against brand and clarity signals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text-primary font-sans">
        {/* Skip link: first focusable element, visually hidden until focused, so
            keyboard / screen-reader users can jump past the header straight to the
            page content (WCAG 2.4.1 Bypass Blocks). */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:border focus:border-border focus:bg-surface focus:px-3 focus:py-2 focus:text-label-sm focus:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
