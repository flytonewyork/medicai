"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ensureSeeded } from "~/lib/db/seed";
import { initSync } from "~/lib/sync/init";
import { useUIStore } from "~/stores/ui-store";
import { WelcomeAuthModal } from "~/components/auth/welcome-auth-modal";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const locale = useUIStore((s) => s.locale);

  useEffect(() => {
    ensureSeeded().catch(() => {
      // seeding failures are non-fatal
    });
    initSync().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[sync] init failed", err);
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  return (
    <QueryClientProvider client={client}>
      {children}
      <WelcomeAuthModal />
    </QueryClientProvider>
  );
}
