"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ensureSeeded } from "~/lib/db/seed";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());

  useEffect(() => {
    ensureSeeded().catch(() => {
      // seeding failures are non-fatal
    });
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
