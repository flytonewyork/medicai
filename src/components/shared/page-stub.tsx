"use client";

import { useT } from "~/hooks/use-translate";

export function PageStub({ titleKey, note }: { titleKey: string; note?: string }) {
  const t = useT();
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-4">
      <h1 className="text-2xl font-semibold">{t(titleKey)}</h1>
      <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-8 text-sm text-slate-500">
        {note ?? "Module under construction — see docs/BUILD_ORDER.md."}
      </div>
    </div>
  );
}
