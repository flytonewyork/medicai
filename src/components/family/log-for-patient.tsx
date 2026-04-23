"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { parseDirectFile, type DirectFileResult } from "~/lib/log/direct-file";
import { applyDirectFile } from "~/lib/log/direct-file-apply";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, Textarea } from "~/components/ui/field";
import { Check, MessageSquarePlus, Sparkles } from "lucide-react";
import { todayISO } from "~/lib/utils/date";
import { FollowUpsCard } from "~/components/log/follow-ups-card";

// Caregiver-flavoured log form on /family. Uses the direct-file path
// from PR #72 so a short entry like "blood sugar 7.9 this morning"
// files straight into labs and the FollowUpsCard surfaces next steps.
// For longer narrative entries the existing /log page is one tap away.

export function LogForPatient() {
  const locale = useLocale();
  const enteredBy = useUIStore((s) => s.enteredBy);
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [filed, setFiled] = useState<DirectFileResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed: DirectFileResult | null = useMemo(
    () => parseDirectFile(text, todayISO()),
    [text],
  );

  async function submit() {
    setError(null);
    if (!parsed) return;
    setSaving(true);
    try {
      await applyDirectFile(parsed, enteredBy);
      setFiled(parsed);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setFiled(null);
    setError(null);
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-900">
            <MessageSquarePlus className="h-3.5 w-3.5 text-[var(--tide-2)]" />
            {L("Log something for dad", "代记录")}
          </div>
          <p className="text-[12px] text-ink-500">
            {L(
              "A quick reading or note you just observed. Simple vitals are filed directly; longer narratives go to the log page.",
              "您刚观察到的数值或备注。简短指标会直接归档,较长叙述请使用「记录」页。",
            )}
          </p>
          <Field label={L("Observation", "记录")}>
            <Textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={L(
                "e.g. blood sugar 7.9 this morning · weight 64.5 kg · walked 20 min",
                "例如:血糖 7.9 今早 · 体重 64.5 kg · 步行 20 分钟",
              )}
              disabled={saving}
            />
          </Field>
          {parsed && !filed && (
            <div className="flex items-start gap-1.5 text-[11px] text-[var(--tide-2)]">
              <Check className="mt-[1px] h-3 w-3 shrink-0" />
              <span>
                {L("Will file directly as: ", "将直接归档为: ")}
                <span className="font-medium">{parsed.summary[locale]}</span>
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Link
              href="/log"
              className="text-[11.5px] text-ink-500 hover:text-ink-900"
            >
              {L("Longer note → /log", "长记录 → /log")}
            </Link>
            <Button
              onClick={() => void submit()}
              disabled={!parsed || saving}
              size="sm"
            >
              {saving
                ? L("Saving…", "保存中…")
                : parsed
                  ? L("Save", "保存")
                  : L("Type a reading", "请输入")}
            </Button>
          </div>
          {error && (
            <div className="rounded-md border border-[var(--warn)]/40 bg-[var(--warn-soft)] p-2 text-[12px] text-[var(--warn)]">
              {error}
            </div>
          )}
          {filed && (
            <div className="flex items-start gap-2 rounded-md border border-[var(--ok)]/40 bg-[var(--ok-soft)] p-2.5 text-[12.5px]">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-[var(--ok)]" />
              <div className="flex-1">
                <div className="text-ink-900">{filed.summary[locale]}</div>
                <div className="mt-0.5 text-[11px] text-ink-500">
                  {L("Filed. Agents were not called.", "已归档。智能体未参与。")}
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="text-[11px] text-ink-500 hover:text-ink-900"
              >
                {L("Add another", "再记一条")}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
      {filed && <FollowUpsCard filed={filed} />}
    </>
  );
}
