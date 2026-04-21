import "~/styles/globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "~/components/shared/providers";
import { DesktopSidebar, MobileBottomNav } from "~/components/shared/nav";
import { AddFab } from "~/components/shared/add-fab";

export const metadata: Metadata = {
  title: {
    default: "Anchor",
    template: "%s · Anchor",
  },
  description: "Function preservation and bridge-strategy tracking for metastatic pancreatic cancer.",
  applicationName: "Anchor",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/anchor-mark.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.svg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Anchor",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#19212f" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="flex min-h-screen bg-paper">
            <DesktopSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-ink-100/60 bg-paper-2/70 px-4 backdrop-blur-md md:hidden md:px-6">
                <div className="serif text-[17px] tracking-tight text-ink-900">
                  Anchor
                </div>
                <div className="flex-1" />
              </header>
              <main className="flex-1 overflow-y-auto pb-28 md:pb-6">
                {children}
              </main>
            </div>
          </div>
          <MobileBottomNav />
          <AddFab />
        </Providers>
      </body>
    </html>
  );
}
