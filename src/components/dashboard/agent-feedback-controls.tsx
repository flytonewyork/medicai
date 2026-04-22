"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ThumbsDown, ThumbsUp, MessageSquarePlus, Check } from "lucide-react";
import { db, now } from "~/lib/db/dexie";
import { useT } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";
import type { AgentId, FeedbackKind } from "~/types/agent";

// Renders the dial-in loop's visible half: a row of thumbs and an
// optional correction note that writes to db.agent_feedback. Mounted
// inside an agent_run feed card. Designed to disappear once feedback
// has been given for this run, so the patient/Thomas isn't re-prompted.
export function AgentFeedbackControls({
  agentId,
  runId,
}: {
  agentId: AgentId;
  runId: number;
}) {
  const t = useT();
  const existing = useLiveQuery(
    () =>
      db.agent_feedback
        .where("[agent_id+at]")
        .between([agentId, ""], [agentId, "￿"])
        .reverse()
        .toArray(),
    [agentId],
  );
  const myFeedback = existing?.find((f) => f.run_id === runId);

  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function record(kind: FeedbackKind, notes?: string) {
    setSaving(true);
    try {
      await db.agent_feedback.add({
        agent_id: agentId,
        run_id: runId,
        kind,
        by: "thomas", // single-writer assumption today; expand when patient UI lands
        notes: notes?.trim() ? notes.trim() : undefined,
        at: now(),
      });
      setOpen(false);
      setNote("");
    } finally {
      setSaving(false);
    }
  }

  if (myFeedback) {
    return (
      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-ink-500">
        <Check className="h-3 w-3 text-[var(--ok)]" />
        <span>
          {t("agentFeedback.recorded")} ·{" "}
          {labelForKind(t, myFeedback.kind)}
        </span>
      </div>
    );
  }

  return (
    <div
      className="mt-3 border-t border-ink-100/60 pt-2.5"
      // Stop the wrapping <Link> on cta-bearing rows from swallowing clicks
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <FeedbackButton
            label={t("agentFeedback.helpful")}
            disabled={saving}
            onClick={() => void record("thumbs_up")}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </FeedbackButton>
          <FeedbackButton
            label={t("agentFeedback.offBase")}
            disabled={saving}
            onClick={() => void record("thumbs_down")}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </FeedbackButton>
          <FeedbackButton
            label={t("agentFeedback.correct")}
            disabled={saving}
            onClick={() => setOpen((v) => !v)}
            active={open}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
          </FeedbackButton>
        </div>
      </div>

      {open && (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return;
            void record("correction", note);
          }}
        >
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t("agentFeedback.correctionPlaceholder")}
            disabled={saving}
            className="w-full rounded-md border border-ink-200 bg-paper-2 p-2 text-[12.5px] leading-snug"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setOpen(false);
                setNote("");
              }}
              className="text-[11px] text-ink-500 hover:text-ink-900"
            >
              {t("agentFeedback.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving || !note.trim()}
              className="rounded-md border border-ink-900 bg-ink-900 px-3 py-1 text-[11px] font-semibold text-paper disabled:opacity-50"
            >
              {saving ? t("agentFeedback.saving") : t("agentFeedback.send")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function FeedbackButton({
  children,
  label,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-50",
        active
          ? "border-ink-900 bg-ink-900 text-paper"
          : "border-ink-200 bg-paper-2 text-ink-500 hover:border-ink-400 hover:text-ink-900",
      )}
    >
      {children}
    </button>
  );
}

function labelForKind(t: (k: string) => string, kind: FeedbackKind): string {
  switch (kind) {
    case "thumbs_up":
      return t("agentFeedback.helpful");
    case "thumbs_down":
      return t("agentFeedback.offBase");
    case "correction":
      return t("agentFeedback.correct");
  }
}
