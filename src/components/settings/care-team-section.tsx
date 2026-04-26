"use client";

import Link from "next/link";
import { useLocale } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import { UserPlus, ChevronRight, Users } from "lucide-react";

// Care team management has moved to /carers — the unified surface for
// household members (Anchor accounts) AND the local contact registry
// (oncologist phones, on-call lines, allied health). This stub keeps a
// hand-off in /settings for muscle-memory; the real UI lives at
// /carers with a single "Add carer" CTA.
//
// Why empty here? Splitting the same management UI across two URLs
// (/settings#care-team and /carers) made the "no obvious way to add
// carers" complaint inevitable. One destination is clearer.
export function CareTeamSection() {
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  return (
    <section className="space-y-3">
      <h2 className="eyebrow">
        <Users className="mr-1.5 inline h-3.5 w-3.5" />
        {L("Care team", "护理团队")}
      </h2>
      <Link href="/carers">
        <Card className="transition-colors hover:border-ink-300">
          <CardContent className="flex items-center justify-between gap-3 pt-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--tide-2)]/15 text-[var(--tide-2)]">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-ink-900">
                  {L("Manage carers", "管理护理人员")}
                </div>
                <p className="mt-0.5 text-[11.5px] text-ink-500">
                  {L(
                    "Add family, clinicians, and local contacts on /carers.",
                    "前往 /carers 添加家人、医师及本地联系人。",
                  )}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-ink-400" />
          </CardContent>
        </Card>
      </Link>
    </section>
  );
}
