"use client";

import { useState } from "react";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { tagInput } from "~/lib/log/tag";
import { Button } from "~/components/ui/button";
import { Field, Textarea } from "~/components/ui/field";
import { Card, CardContent } from "~/components/ui/card";
import { Send, Check, Loader2 } from "lucide-react";

// One-textarea contribution surface for family members. Writes a
// `log_events` row tagged (via the existing tagger, or defaulting to
// "symptom" if no strong signal). The existing daily agent batch picks
// it up on its next run — no new back-end.

type State = "idle" | "saving" | "done" | "error";

export function QuickNote() {
  const locale = useLocale();
  const enteredBy = useUIStore((s) => s.enteredBy);
  const [text, setText] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const body = text.trim();
    if (!body) return;
    setState("saving");
    setError(null);
    try {
      const tags = tagInput(body);
      const at = new Date().toISOString();
      const { getCachedUserId } = await import("~/lib/supabase/current-user");
      const uid = getCachedUserId();
      await db.log_events.add({
        at,
        input: {
          text: `[${enteredBy}] ${body}`,
          tags: tags.length > 0 ? tags : ["symptom"],
          locale,
          at,
          entered_by: enteredBy,
          entered_by_user_id: uid ?? undefined,
        },
      });
      setText("");
      setState("done");
      window.setTimeout(() => setState("idle"), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">
            {locale === "zh" ? "告诉团队" : "Tell the team"}
          </h2>
          {state === "done" && (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--ok)]">
              <Check className="h-3 w-3" />
              {locale === "zh" ? "已发送" : "Sent"}
            </span>
          )}
        </div>
        <Field label={locale === "zh" ? "想记下的一点" : "What you noticed"}>
          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              locale === "zh"
                ? "例如：今天爸爸午饭吃得不多，下午有些乏力，但傍晚散步 20 分钟精神不错。"
                : "e.g. Dad didn't eat much at lunch, seemed tired in the afternoon, but did a 20-minute walk at dusk and perked up."
            }
            disabled={state === "saving"}
          />
        </Field>
        {error && (
          <div
            role="alert"
            className="rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-2.5 text-[12.5px] text-[var(--warn)]"
          >
            {error}
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-ink-400">
            {locale === "zh"
              ? "保存到共享日志，团队可以看到。"
              : "Saved to the shared log; team members will see it."}
          </p>
          <Button onClick={submit} disabled={state === "saving" || !text.trim()}>
            {state === "saving" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {locale === "zh" ? "发送中…" : "Sending…"}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {locale === "zh" ? "发送" : "Send"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
