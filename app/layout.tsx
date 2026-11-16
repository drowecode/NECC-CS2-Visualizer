import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { Nav } from "@/components/Nav";
import "@fontsource/saira/400.css";
import "@fontsource/saira/500.css";
import "@fontsource/saira/600.css";
import "@fontsource/saira-condensed/600.css";
import "@fontsource/saira-condensed/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "NECC CS2 Rankings",
  description: "Standings, rankings and team pages for the NECC Fall 2026 CS2 divisions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-end gap-x-10 gap-y-2 px-4 pt-4">
            <Link href="/" className="pb-3 font-display text-2xl font-bold leading-none tracking-tight">
              NECC <span className="text-accent">CS2</span>
            </Link>
            <Suspense fallback={<div className="h-10" />}>
              <Nav />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 text-sm text-faint">
            Fall 2026 regular season. Data from the FACEIT Data API. Not affiliated with NECC or FACEIT.
          </div>
        </footer>
        {/* Vercel Web Analytics: counts visitors and page views on the deployed site. */}
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
      </body>
    </html>
  );
}
