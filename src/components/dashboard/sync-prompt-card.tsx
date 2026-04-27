"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff, X } from "lucide-react";
import { db } from "~/lib/db/dexie";
import { getSupabaseBrowser, isSupabaseConfigured } from "~/lib/supabase/client";
import { useT } from "~/hooks/use-translate";

const DISMISS_KEY = "anchor.syncPromptDismissedAt";

export function SyncPromptCard() {
  const t = useT();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);

  const entryCount = useLiveQuery(() => db.daily_entries.count());

  useEffect(() => {
    setDismissed(Boolean(localStorage.getItem(DISMISS_KEY)));
    if (!isSupabaseConfigured()) {
      setSignedIn(true);
      return;
    }
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setSignedIn(true);
      return;
    }
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    // Sign-in clears the dismiss key so a future sign-out will resurface
    // the prompt rather than leaving it permanently silenced. Without
    // this, dismissing once made the nudge invisible for the rest of
    // the install.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = Boolean(session?.user);
      setSignedIn(next);
      if (next) {
        try {
          localStorage.removeItem(DISMISS_KEY);
        } catch {
          // ignore — private mode etc.
        }
        setDismissed(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured()) return null;
  if (signedIn !== false) return null;
  if (dismissed) return null;
  if (!entryCount || entryCount < 1) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setDismissed(true);
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-ink-200 bg-paper-2/70 px-4 py-3">
      <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" aria-hidden />
      <div className="flex-1 space-y-1 text-sm">
        <p className="font-medium text-ink-800">{t("syncPrompt.title")}</p>
        <p className="text-ink-600">{t("syncPrompt.body")}</p>
        <div className="pt-1">
          <Link
            href="/login"
            className="inline-flex items-center rounded-md border border-ink-300 bg-paper px-3 py-1.5 text-xs font-medium text-ink-800 hover:border-ink-400 hover:bg-paper-2"
          >
            {t("syncPrompt.cta")}
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("syncPrompt.dismiss")}
        className="shrink-0 rounded p-1 text-ink-400 hover:text-ink-700"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
