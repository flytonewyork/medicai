import "~/styles/globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "~/components/shared/providers";
import { DesktopSidebar, MobileBottomNav } from "~/components/shared/nav";
import { LanguageSwitcher } from "~/components/shared/language-switcher";
import { RoleSwitcher } from "~/components/shared/role-switcher";

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
          <div className="flex min-h-screen">
            <DesktopSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <header className="flex items-center justify-between gap-3 px-4 md:px-6 h-12 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="md:hidden text-sm font-semibold">Anchor</div>
                <div className="flex-1" />
                <RoleSwitcher />
                <LanguageSwitcher />
              </header>
              <main className="flex-1 pb-24 md:pb-0 overflow-y-auto">
                {children}
              </main>
            </div>
          </div>
          <MobileBottomNav />
        </Providers>
      </body>
    </html>
  );
}
