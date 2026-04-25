import "~/styles/globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "~/components/shared/providers";
import {
  DesktopSidebar,
  MobileBottomNav,
  MobileMoreMenu,
} from "~/components/shared/nav";
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
    // "black-translucent" lets the WebView draw under the status bar — the
    // safe-area padding in globals.css keeps touch targets and content out
    // of the notch. Required for the Capacitor iOS shell to feel native.
    statusBarStyle: "black-translucent",
    title: "Anchor",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f1e8",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" style={{ colorScheme: "light" }}>
      <body>
        <Providers>
          <div className="flex min-h-[100dvh] bg-paper md:pt-[env(safe-area-inset-top)]">
            <DesktopSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Mobile header bakes the safe-area inset into its own height
               * (rather than letting the outer wrapper pad above it) so the
               * navbar's background always covers the status-bar zone. With
               * the older outer-padding setup the sticky header would
               * visually grow on scroll once the wrapper's padding scrolled
               * away and the translucent status bar exposed the page
               * underneath. */}
              <header
                className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-ink-100/60 bg-paper-2/70 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden md:px-6"
                style={{ height: "calc(3.5rem + env(safe-area-inset-top))" }}
              >
                <div className="serif text-[17px] tracking-tight text-ink-900">
                  Anchor
                </div>
                <MobileMoreMenu />
              </header>
              <main className="flex-1 overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-6">
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
