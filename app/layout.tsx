import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", style: ["normal"] });

export const metadata: Metadata = {
  title: { default: "Developer Pulse", template: "%s · Developer Pulse" },
  description: "Weekly developer community intelligence: what pain points are surfacing, how they are trending, and what is still unresolved.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1424" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
      <body className="min-h-dvh">
        <ToastProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2">
            Skip to content
          </a>
          <header className="border-b border-rule">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <PulseMark />
                Developer Pulse
              </Link>
              <NavLinks />
            </div>
          </header>
          <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            {children}
          </main>
          <footer className="border-t border-rule">
            <p className="mx-auto max-w-6xl px-4 py-5 text-sm text-muted sm:px-6">
              This brief measures and explains. Sprint decisions stay with you.
            </p>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}

function PulseMark() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true">
      <path d="M1 9h5l2-6 4 11 2.5-7H21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
