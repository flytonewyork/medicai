"use client";

import { useState } from "react";
import { db, now } from "~/lib/db/dexie";
import {
  PREP_KIND_LABEL,
  activeFast,
  isPrepActive,
  prepStartMs,
  sortPrepForRender,
} from "~/lib/appointments/prep";
import type { Appointment, AppointmentPrep } from "~/types/appointment";
import { useLocale } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import { PrepEditor } from "./prep-editor";
import { Button } from "~/components/ui/button";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  Pencil,
  Save as SaveIcon,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

// Read-first preparation block for /schedule/[id]. Renders each prep
// item with a tap-to-complete checkbox, an "active now" highlight
// when inside a fast/arrive-early window, and an inline edit mode
// backed by the same PrepEditor the appointment form uses.

export function PrepPanel({ appt }: { appt: Appointment }) {
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AppointmentPrep[]>(appt.prep ?? []);
  const [saving, setSaving] = useState(false);

  const items = sortPrepForRender(appt);
  const fast = activeFast(appt);

  async function toggleComplete(i: number, item: AppointmentPrep) {
    if (typeof appt.id !== "number") return;
    const next = (appt.prep ?? []).slice();
    const idx = next.indexOf(item);
    const pos = idx >= 0 ? idx : i;
    const target = next[pos];
    if (!target) return;
    next[pos] = {
      ...target,
      completed_at: target.completed_at ? undefined : now(),
    };
    await db.appointments.update(appt.id, {
      prep: next,
      updated_at: now(),
    });
  }

  async function saveEdit() {
    if (typeof appt.id !== "number") return;
    setSaving(true);
    try {
      await db.appointments.update(appt.id, {
        prep: draft.filter((p) => p.description.trim().length > 0),
        updated_at: now(),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleInfoReceived() {
    if (typeof appt.id !== "number") return;
    await db.appointments.update(appt.id, {
      prep_info_received: !(appt.prep_info_received ?? true),
      updated_at: now(),
    });
  }

  const awaiting = appt.prep_info_received === false;

  // Hide the panel entirely when nothing to show AND not awaiting AND
  // the patient isn't actively editing.
  if (!editing && items.length === 0 && !awaiting) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between pt-4">
          <p className="text-[12.5px] text-ink-500">
            {L("No preparation on file.", "暂无准备事项。")}
          </p>
          <Button variant="ghost" size="md" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            {L("Add prep", "添加")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-900">
            {L("Preparation", "准备事项")}
          </div>
          {editing ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setDraft(appt.prep ?? []);
                  setEditing(false);
                }}
                disabled={saving}
              >
                <X className="h-3.5 w-3.5" />
                {L("Cancel", "取消")}
              </Button>
              <Button size="md" onClick={saveEdit} disabled={saving}>
                <SaveIcon className="h-3.5 w-3.5" />
                {saving ? L("Saving…", "保存中…") : L("Save", "保存")}
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="md" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              {L("Edit", "编辑")}
            </Button>
          )}
        </div>

        {fast && !editing && (
          <div className="flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--warn)]/40 bg-[var(--warn-soft)] p-2.5 text-[12.5px] text-[var(--warn)]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <div className="font-semibold">
                {L("Fasting now", "正在禁食")}
              </div>
              <div className="text-[12px] opacity-90">{fast.description}</div>
            </div>
          </div>
        )}

        {awaiting && !editing && (
          <div className="flex items-start justify-between gap-2 rounded-[var(--r-md)] border border-[var(--sand-2)] bg-[var(--sand)]/40 p-2.5 text-[12.5px] text-ink-800">
            <div>
              <div className="font-semibold">
                {L("Still waiting on prep info", "等待准备事项信息")}
              </div>
              <div className="text-[11.5px] text-ink-600">
                {L(
                  `Ask ${appt.doctor ?? "the clinic"} for the details.`,
                  `请向 ${appt.doctor ?? "医护团队"} 索取具体要求。`,
                )}
              </div>
            </div>
            <Button variant="ghost" size="md" onClick={toggleInfoReceived}>
              {L("Received", "已收到")}
            </Button>
          </div>
        )}

        {editing ? (
          <PrepEditor value={draft} onChange={setDraft} />
        ) : items.length === 0 ? (
          <p className="text-[12px] text-ink-500">
            {L("No prep items yet.", "暂无准备事项。")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item, i) => {
              const active = isPrepActive(appt, item);
              const done = Boolean(item.completed_at);
              const startMs = prepStartMs(appt, item);
              const startLabel = startMs
                ? new Date(startMs).toLocaleString(
                    locale === "zh" ? "zh-CN" : "en-AU",
                    { weekday: "short", hour: "numeric", minute: "2-digit" },
                  )
                : null;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-3 rounded-md border px-2.5 py-2",
                    done
                      ? "border-ink-100 bg-paper-2 text-ink-400"
                      : active
                        ? "border-[var(--warn)]/40 bg-[var(--warn-soft)]"
                        : "border-ink-100 bg-paper-2",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void toggleComplete(i, item)}
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      done
                        ? "border-[var(--ok)] bg-[var(--ok)] text-paper"
                        : "border-ink-300 bg-paper",
                    )}
                    aria-label={done ? L("Undo", "撤销") : L("Mark done", "标记完成")}
                  >
                    {done ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <CircleDashed className="h-3 w-3 text-ink-400" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "text-[10px] font-medium uppercase tracking-[0.08em]",
                          "rounded-full px-1.5 py-0.5",
                          active
                            ? "bg-[var(--warn)] text-paper"
                            : "bg-ink-100 text-ink-700",
                        )}
                      >
                        {PREP_KIND_LABEL[item.kind][locale]}
                      </span>
                      <span
                        className={cn(
                          "text-[12.5px]",
                          done ? "line-through" : "text-ink-900",
                        )}
                      >
                        {item.description}
                      </span>
                    </div>
                    {startLabel && !done && (
                      <div className="mt-0.5 text-[11px] text-ink-500">
                        {active
                          ? L(`Started ${startLabel}`, `${startLabel} 起`)
                          : L(`Starts ${startLabel}`, `${startLabel} 开始`)}
                        {item.info_source &&
                          ` · ${L("from", "来自")} ${L(item.info_source, item.info_source)}`}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
