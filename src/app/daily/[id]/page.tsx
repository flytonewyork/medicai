"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "~/lib/db/dexie";
import { todayISO } from "~/lib/utils/date";
import { DailyWizard } from "~/components/daily/daily-wizard";

export default function EditDailyPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!Number.isFinite(id)) {
        if (!cancelled) setDate(todayISO());
        return;
      }
      const row = await db.daily_entries.get(id);
      if (!cancelled) setDate(row?.date ?? todayISO());
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (date === null) return null;
  return (
    <DailyWizard entryId={Number.isFinite(id) ? id : undefined} date={date} />
  );
}
