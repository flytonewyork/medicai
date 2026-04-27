"use client";

import { useEffect } from "react";
import { ensureSeeded } from "~/lib/db/seed";
import { initSync } from "~/lib/sync/init";
import { useUIStore } from "~/stores/ui-store";
import { WelcomeAuthModal } from "~/components/auth/welcome-auth-modal";
import { IngestModal } from "~/components/ingest/ingest-modal";
import { ObserverBanner } from "~/components/shared/observer-banner";

export function Providers({ children }: { children: React.ReactNode }) {
  const locale = useUIStore((s) => s.locale);

  useEffect(() => {
    ensureSeeded().catch(() => {
      // seeding failures are non-fatal
    });
    initSync().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[sync] init failed", err);
    });
    // Slice D: register the push service worker early so subscribing
    // later (from Settings) is a synchronous-feeling flow. Safe to
    // call unconditionally — unsupported environments no-op.
    void import("~/lib/push/client").then(({ registerServiceWorker }) =>
      registerServiceWorker(),
    );
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  return (
    <>
      <ObserverBanner />
      {children}
      <WelcomeAuthModal />
      <IngestModal />
    </>
  );
}
