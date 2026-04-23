"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getCurrentProfile,
  isProfileComplete,
} from "~/lib/supabase/households";
import { useLocale } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import { UserCircle2, ChevronRight } from "lucide-react";

// Nag banner shown to carers who landed on /family but never completed the
// welcome wizard (either because they skipped it or joined before the flow
// existed). Self-hides as soon as the profile has a name + relationship.
export function ProfileCompletionBanner() {
  const locale = useLocale();
  const [incomplete, setIncomplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await getCurrentProfile().catch(() => null);
      if (!cancelled) setIncomplete(p !== null && !isProfileComplete(p));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!incomplete) return null;

  return (
    <Link href="/invite/welcome" className="block">
      <Card className="border-[var(--tide-2)]/40 bg-[var(--tide-soft)] transition-colors hover:border-[var(--tide-2)]">
        <CardContent className="flex items-center gap-3 p-4">
          <UserCircle2 className="h-5 w-5 shrink-0 text-[var(--tide-2)]" />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-ink-900">
              {locale === "zh"
                ? "完善您的个人资料"
                : "Finish setting up your profile"}
            </div>
            <p className="mt-0.5 text-[12px] text-ink-700">
              {locale === "zh"
                ? "让团队知道您的身份，时间以您的时区显示。两分钟搞定。"
                : "Tell the team who you are so times show in your own zone. Takes a minute."}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
        </CardContent>
      </Card>
    </Link>
  );
}
