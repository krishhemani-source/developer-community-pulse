import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { BRAND, SignalMark, Wordmark } from "@/components/brand";
import { NavLinks } from "@/components/nav-links";
import { SignalPing } from "@/components/signal-ping";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", style: ["normal"] });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} · ${BRAND.descriptor}`, template: `%s · ${BRAND.name}` },
  description: `${BRAND.tagline} ${BRAND.name} reads developer communities every week and shows which pain points are surfacing, how they are trending, and what is still unsolved.`,
  applicationName: BRAND.name,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b15" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
      <body className="min-h-dvh">
        <ToastProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
            Skip to content
          </a>
          <div className="lg:grid lg:min-h-dvh lg:grid-cols-[15.5rem_minmax(0,1fr)]">
            {/* Sidebar (desktop) */}
            <aside className="sticky top-0 hidden h-dvh flex-col border-r border-rule bg-surface px-4 py-6 lg:flex">
              <Wordmark className="px-2" />
              <NavLinks orientation="vertical" className="mt-10" />
              <div className="mt-auto space-y-3 border-t border-rule px-2 pt-5 text-xs text-muted">
                <p className="flex items-center gap-2">
                  <SignalPing />
                  New brief every Friday, 08:00 IST
                </p>
                <p className="leading-relaxed">{BRAND.tagline}</p>
              </div>
            </aside>

            <div className="flex min-h-dvh min-w-0 flex-col">
              {/* Top bar (mobile and tablet) */}
              <header className="border-b border-rule bg-surface lg:hidden">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
                  <Wordmark />
                  <NavLinks orientation="horizontal" />
                </div>
              </header>

              <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 lg:px-10 lg:py-10">
                {children}
              </main>

              <footer className="border-t border-rule">
                <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
                  <p>This brief measures and explains. Sprint decisions stay with you.</p>
                  <p className="flex items-center gap-1.5 text-xs">
                    <SignalMark size={14} className="text-muted" />
                    {BRAND.name} · {BRAND.descriptor}
                  </p>
                </div>
              </footer>
            </div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
