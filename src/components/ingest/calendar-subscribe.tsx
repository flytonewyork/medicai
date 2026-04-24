"use client";

import { useState } from "react";
import { useBilingual } from "~/hooks/use-bilingual";
import { useSettings } from "~/hooks/use-settings";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, TextInput, Textarea } from "~/components/ui/field";
import { Calendar, AlertCircle, Loader2 } from "lucide-react";
import type { IngestDraft } from "~/types/ingest";

// Feeds the ICS path through the same preview-diff flow. Accepts
// either a webcal:// / https:// subscription URL (Apple Calendar,
// iCloud shared calendars, Google public URLs) or a pasted ICS
// payload for users whose clinic can't give them a live URL.

export function CalendarSubscribe({
  onDraft,
}: {
  onDraft: (draft: IngestDraft) => void;
}) {
  const L = useBilingual();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pull the patient's home timezone so floating ICS times (no TZID) are
  // resolved to the right wall clock. Falls back to the browser zone.
  const homeTz = useSettings()?.home_timezone;

  async function fetchAndParse() {
    const canUrl = url.trim().length > 0;
    const canText = text.trim().length > 0;
    if (!canUrl && !canText) return;
    setBusy(true);
    setError(null);
    try {
      const fallbackTimezone =
        homeTz ??
        (() => {
          try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
          } catch {
            return "Australia/Melbourne";
          }
        })();
      const payload = canUrl
        ? { url: url.trim(), fallbackTimezone }
        : { text, fallbackTimezone };
      const res = await fetch("/api/ingest-ics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { draft: IngestDraft };
      onDraft(data.draft);
      setUrl("");
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-900">
          <Calendar className="h-3.5 w-3.5 text-[var(--tide-2)]" />
          {L("Import from a shared calendar", "从共享日历导入")}
        </div>
        <p className="text-[12px] text-ink-500">
          {L(
            "Paste an Apple / iCloud, Google, or any ICS subscription URL. We'll fetch it, list every event, and you approve which ones land in Anchor.",
            "粘贴 Apple / iCloud、Google 或任意 ICS 订阅链接。我们会抓取并列出所有事件，由你选择导入哪些。",
          )}
        </p>

        <Field
          label={L("Subscription URL", "订阅链接")}
          hint={L(
            "In the Calendar app: right-click the shared calendar → Share Calendar → Public Calendar → copy the URL. webcal://, https://, .ics all work.",
            "日历应用：右键共享日历 → 共享 → 公开日历，复制链接。webcal://、https:// 或 .ics 均可。",
          )}
        >
          <TextInput
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="webcal://p55-calendars.icloud.com/…"
            disabled={busy}
          />
        </Field>

        <div className="text-[11px] text-ink-400">{L("OR", "或")}</div>

        <Field label={L("Paste ICS text", "粘贴 ICS 文本")}>
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="BEGIN:VCALENDAR…"
            disabled={busy}
          />
        </Field>

        <div className="flex items-center justify-end gap-2">
          {busy && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {L("Fetching…", "读取中…")}
            </span>
          )}
          <Button
            onClick={fetchAndParse}
            disabled={busy || (!url.trim() && !text.trim())}
          >
            {L("Read calendar", "读取日历")}
          </Button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-2.5 text-[12.5px] text-[var(--warn)]"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
