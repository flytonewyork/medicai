"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ensureSeeded } from "~/lib/db/seed";
import { useUIStore } from "~/stores/ui-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const locale = useUIStore((s) => s.locale);

  useEffect(() => {
    ensureSeeded().catch(() => {
      // seeding failures are non-fatal
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
