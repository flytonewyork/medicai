"use client";

import { useParams } from "next/navigation";
import { MorningCheckin } from "~/components/daily/morning-checkin";

export default function EditDailyPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  return <MorningCheckin entryId={Number.isFinite(id) ? id : undefined} />;
}
