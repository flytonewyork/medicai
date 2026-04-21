"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "~/lib/db/dexie";
import { todayISO } from "~/lib/utils/date";
import { MorningCheckin } from "~/components/daily/morning-checkin";

export default function NewDailyPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
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
  return <MorningCheckin entryId={entryId ?? undefined} date={date} />;
}
