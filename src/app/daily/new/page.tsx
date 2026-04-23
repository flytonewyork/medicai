"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "~/lib/db/dexie";
import { todayISO } from "~/lib/utils/date";
import { DailyWizard } from "~/components/daily/daily-wizard";
import { useRedirectCaregiverAway } from "~/lib/caregiver/guard";

export default function NewDailyPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  useRedirectCaregiverAway();
  const params = useSearchParams();
  const date = params.get("date") ?? todayISO();
  const [entryId, setEntryId] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const row = await db.daily_entries.where("date").equals(date).first();
      if (!cancelled) setEntryId(row?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  if (entryId === undefined) return null;
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <DailyWizard entryId={entryId ?? undefined} date={date} />
    </div>
  );
}
