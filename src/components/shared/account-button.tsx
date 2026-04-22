"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { getSupabaseBrowser, isSupabaseConfigured } from "~/lib/supabase/client";
import { useT } from "~/hooks/use-translate";
import { SyncStatusPill } from "./sync-status";

// Minimal "who am I / sign out" control. Rendered in settings.
export function AccountButton() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function handleSignOut() {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setLoading(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (!isSupabaseConfigured()) return null;

  return (
    <div className="space-y-2 rounded-md border border-ink-100/70 bg-paper-2/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <User className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
          <span className="truncate text-[13px] text-ink-700">
            {email ?? "—"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1.5 text-xs text-ink-700 hover:border-ink-300 hover:bg-paper-2 disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          {t("account.signOut")}
        </button>
      </div>
      <SyncStatusPill />
    </div>
  );
}
