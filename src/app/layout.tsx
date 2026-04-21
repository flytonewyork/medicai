import "~/styles/globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "~/components/shared/providers";
import { DesktopSidebar, MobileBottomNav } from "~/components/shared/nav";
import { LanguageSwitcher } from "~/components/shared/language-switcher";
import { RoleSwitcher } from "~/components/shared/role-switcher";
import { AddFab } from "~/components/shared/add-fab";

export const metadata: Metadata = {
  title: "Anchor",
  description: "Function preservation and bridge strategy tracking.",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="flex min-h-screen bg-paper">
            <DesktopSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-ink-100/60 bg-paper-2/70 px-4 backdrop-blur-md md:px-6">
                <div className="serif text-[17px] tracking-tight text-ink-900 md:hidden">
                  Anchor
                </div>
                <div className="flex-1" />
                <RoleSwitcher />
                <LanguageSwitcher />
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
