"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff, X } from "lucide-react";
import { db, now } from "~/lib/db/dexie";
import { getSupabaseBrowser, isSupabaseConfigured } from "~/lib/supabase/client";
import { useT } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";

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
    localStorage.setItem(DISMISS_KEY, now());
    setDismissed(true);
  }

  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-500">
          <CloudOff className="h-4 w-4" aria-hidden />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-[13px] font-semibold text-ink-900">
            {t("syncPrompt.title")}
          </p>
          <p className="text-[11.5px] text-ink-500">{t("syncPrompt.body")}</p>
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
          className="-mr-1 -mt-1 shrink-0 rounded p-1 text-ink-400 hover:text-ink-700"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </CardContent>
    </Card>
  );
}
