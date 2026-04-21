"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { useActiveCycleContext } from "~/hooks/use-active-cycle";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { DRUGS_BY_ID } from "~/config/drug-registry";
import {
  evaluatePrompts,
  type MedicationPrompt,
  type PromptCitation,
  type PromptSeverity,
} from "~/lib/medication/prompts";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  ExternalLink,
  Info,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

const TONE_BY_SEVERITY: Record<
  PromptSeverity,
  { wrap: string; chip: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  info: {
    wrap: "bg-paper-2",
    chip: "bg-ink-100 text-ink-700",
    Icon: Info,
  },
  caution: {
    wrap: "bg-[var(--sand)]/40 border-l-[3px] border-l-[oklch(45%_0.06_70)]",
    chip: "bg-[oklch(92%_0.04_70)] text-[oklch(45%_0.06_70)]",
    Icon: Bell,
  },
  warning: {
    wrap: "bg-[var(--warn-soft)] border-l-[3px] border-l-[var(--warn)]",
    chip: "bg-[var(--warn)] text-white",
    Icon: AlertTriangle,
  },
};

export function MedicationPromptsCard() {
  const locale = useLocale();
  const ctx = useActiveCycleContext();
  const meds = useLiveQuery(() => db.medications.toArray(), []);
  const events = useLiveQuery(
    () => db.medication_prompt_events.toArray(),
    [],
  );

  const prompts = useMemo<MedicationPrompt[]>(() => {
    if (!ctx) return [];
    return evaluatePrompts({
      cycle: ctx.cycle,
      cycle_day: ctx.cycle_day,
      protocol_id: ctx.cycle.protocol_id,
      active_meds: meds ?? [],
      drugs_by_id: DRUGS_BY_ID,
      existing_events: events ?? [],
    });
  }, [ctx, meds, events]);

  if (!ctx) return null;
  if (prompts.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="eyebrow px-1">
        {locale === "zh" ? "用药相关提示" : "Medication prompts"}
      </div>
      <div className="space-y-2">
        {prompts.map((p) => (
          <PromptRow key={`${p.rule_id}|${p.fired_for}`} prompt={p} />
        ))}
      </div>
    </section>
  );
}

function PromptRow({ prompt }: { prompt: MedicationPrompt }) {
  const locale = useLocale();
  const tone = TONE_BY_SEVERITY[prompt.severity];
  const [showSources, setShowSources] = useState(false);

  const handleAction = async (
    status: "acknowledged" | "dismissed",
    note?: string,
  ) => {
    const ts = now();
    const existing = await db.medication_prompt_events
      .where("[rule_id+fired_for]")
      .equals([prompt.rule_id, prompt.fired_for])
      .first();
    if (existing?.id) {
      await db.medication_prompt_events.update(existing.id, {
        status,
        resolved_at: ts,
        note,
      });
      return;
    }
    await db.medication_prompt_events.add({
      rule_id: prompt.rule_id,
      fired_for: prompt.fired_for,
      drug_id: prompt.drug_id,
      cycle_id: prompt.cycle_id,
      cycle_day: prompt.cycle_day,
      status,
      shown_at: ts,
      resolved_at: ts,
      note,
    });
  };

  const onPrimary = async () => {
    if (prompt.primary_action.kind === "ack") {
      await handleAction("acknowledged");
    } else {
      // For non-ack actions, surface a link below; we still mark acknowledged
      // so the prompt doesn't re-show in the same window.
      await handleAction("acknowledged");
    }
  };

  const onDismiss = () => {
    void handleAction("dismissed");
  };

  return (
    <Card className={cn("relative px-4 py-4", tone.wrap)}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            tone.chip,
          )}
        >
          <tone.Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-ink-900">
            {prompt.title[locale]}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-700">
            {prompt.body[locale]}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PrimaryAction prompt={prompt} onAck={onPrimary} />
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-ink-500"
            >
              {locale === "zh" ? "关闭" : "Dismiss"}
            </Button>
            {prompt.citations.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSources((v) => !v)}
                className="ml-auto text-[11px] text-ink-500 hover:text-ink-900"
              >
                {showSources
                  ? locale === "zh"
                    ? "隐藏来源"
                    : "Hide sources"
                  : locale === "zh"
                    ? `来源 (${prompt.citations.length})`
                    : `Sources (${prompt.citations.length})`}
              </button>
            )}
          </div>

          {showSources && (
            <ul className="mt-2 space-y-1 border-t border-ink-100/60 pt-2">
              {prompt.citations.map((c, i) => (
                <li key={i}>
                  <CitationLink citation={c} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function PrimaryAction({
  prompt,
  onAck,
}: {
  prompt: MedicationPrompt;
  onAck: () => void | Promise<void>;
}) {
  const locale = useLocale();
  const label = prompt.primary_action.label[locale];
  const variant: "primary" | "tide" =
    prompt.severity === "warning" ? "primary" : "tide";

  if (prompt.primary_action.kind === "log_lab") {
    return (
      <Link href="/labs" onClick={() => void onAck()}>
        <Button variant={variant} size="sm" className="gap-1">
          {label}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    );
  }
  if (prompt.primary_action.kind === "log_mood") {
    return (
      <Link href="/daily" onClick={() => void onAck()}>
        <Button variant={variant} size="sm" className="gap-1">
          {label}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    );
  }
  if (prompt.primary_action.kind === "call_clinic") {
    return (
      <Link href="/settings#emergency" onClick={() => void onAck()}>
        <Button variant={variant} size="sm" className="gap-1">
          {label}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    );
  }
  return (
    <Button variant={variant} size="sm" onClick={() => void onAck()}>
      {label}
    </Button>
  );
}

function CitationLink({ citation }: { citation: PromptCitation }) {
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-900"
    >
      <ExternalLink className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {citation.publisher ? `${citation.publisher} — ` : ""}
        {citation.label}
      </span>
    </a>
  );
}
