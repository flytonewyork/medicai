"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useTodayFeed } from "~/hooks/use-today-feed";
import { useWeather } from "~/hooks/use-weather";
import { useLocale, useT } from "~/hooks/use-translate";
import { generateNarrative } from "~/lib/nudges/ai-narrative";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { localize, type FeedItem } from "~/types/feed";
import { AgentFeedbackControls } from "./agent-feedback-controls";
import type { AgentId } from "~/types/agent";
import { cn } from "~/lib/utils/cn";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Sun,
  Cloud,
  ShieldAlert,
  Clock,
  Pill,
  Utensils,
  Footprints,
  Moon,
  MessageCircle,
  User,
  Thermometer,
  Check,
  Circle,
  CheckCircle2,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  thermo: Thermometer,
  shield: ShieldAlert,
  pill: Pill,
  food: Utensils,
  walk: Footprints,
  moon: Moon,
  chat: MessageCircle,
  sun: Sun,
  drop: Cloud,
  anchor: CheckCircle2,
  check: Check,
  clock: Clock,
  user: User,
  pulse: Sparkles,
  dot: Circle,
};

const TONE_STYLES: Record<FeedItem["tone"], { bg: string; dot: string; border?: string }> = {
  warning: {
    bg: "bg-[var(--warn-soft)]",
    dot: "bg-[var(--warn)]",
    border: "border-l-[3px] border-l-[var(--warn)]",
  },
  caution: {
    bg: "bg-[var(--sand)]/40",
    dot: "bg-[oklch(45%_0.06_70)]",
  },
  positive: {
    bg: "bg-[var(--ok-soft)]",
    dot: "bg-[var(--ok)]",
  },
  info: {
    bg: "bg-paper-2",
    dot: "bg-[var(--tide-2)]",
  },
};

const CACHE_KEY = "anchor_narrative";

export function TodayFeed({
  excludeIds = [],
}: {
  excludeIds?: string[];
} = {}) {
  const locale = useLocale();
  const t = useT();
  const weather = useWeather();
  const rawFeed = useTodayFeed({ weather });
  const feed =
    excludeIds.length === 0
      ? rawFeed
      : rawFeed.filter((f) => !excludeIds.includes(f.id));
  const settings = useLiveQuery(() => db.settings.toArray());
  const apiKey = settings?.[0]?.anthropic_api_key;
  const model = settings?.[0]?.default_ai_model ?? "claude-opus-4-7";

  const [expanded, setExpanded] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  const visible = expanded ? feed : feed.slice(0, 6);

  // Narrative fetch — cached daily per locale
  useEffect(() => {
    if (!apiKey || feed.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const cacheTag = `${today}_${locale}`;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { tag: string; text: string };
        if (parsed.tag === cacheTag) {
          setNarrative(parsed.text);
          return;
        }
      }
    } catch {
      // ignore
    }
    setNarrativeLoading(true);
    void (async () => {
      try {
        const text = await generateNarrative({
          apiKey,
          model,
          locale,
          items: feed,
        });
        setNarrative(text);
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ tag: cacheTag, text }),
          );
        } catch {
          // ignore
        }
      } catch {
        setNarrative(null);
      } finally {
        setNarrativeLoading(false);
      }
    })();
  }, [apiKey, model, locale, feed]);

  if (feed.length === 0) {
    return (
      <Card className="p-5 text-sm text-ink-500">{t("todayFeed.empty")}</Card>
    );
  }

  return (
    <div className="space-y-3">
      {narrative && (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--tide-soft)", color: "var(--tide-2)" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <div className="eyebrow mb-1.5">
                {locale === "zh" ? "今天的重点" : "Today's focus"}
              </div>
              <p className="serif text-[17px] leading-[1.5] text-ink-900">
                {narrative}
              </p>
            </div>
          </div>
        </Card>
      )}

      {narrativeLoading && !narrative && (
        <div className="eyebrow px-1">{t("todayFeed.aiLoading")}</div>
      )}

      <ul className="space-y-2">
        {visible.map((item) => (
          <FeedRow key={item.id} item={item} />
        ))}
      </ul>

      {feed.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="eyebrow mx-auto flex items-center gap-1.5 text-ink-500 hover:text-ink-900"
        >
          {expanded
            ? locale === "zh"
              ? "收起"
              : "Show less"
            : locale === "zh"
              ? `再看 ${feed.length - 6} 条`
              : `Show ${feed.length - 6} more`}
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      )}
    </div>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  const locale = useLocale();
  const tone = TONE_STYLES[item.tone];
  const Icon = ICONS[item.icon ?? "dot"] ?? Circle;
  const isAgentRun = item.meta?.kind === "agent_run";
  const body = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[var(--r-md)] p-3.5 transition-colors",
        tone.bg,
        tone.border,
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink-700",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[13.5px] font-semibold text-ink-900">
            {localize(item.title, locale)}
          </div>
          <span
            className={cn(
              "mono shrink-0 text-[9.5px] uppercase tracking-[0.12em]",
              item.tone === "warning"
                ? "text-[var(--warn)]"
                : item.tone === "positive"
                  ? "text-[var(--ok)]"
                  : "text-ink-400",
            )}
          >
            {categoryLabel(item.category, locale)}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-700">
          {localize(item.body, locale)}
        </p>
        {isAgentRun && item.meta?.kind === "agent_run" && (
          <AgentFeedbackControls
            agentId={item.meta.agent_id as AgentId}
            runId={item.meta.run_id}
          />
        )}
      </div>
    </div>
  );
  // Agent-run cards never wrap in a Link — the embedded feedback controls
  // need their own click surface.
  if (item.cta && !isAgentRun) {
    return (
      <Link href={item.cta.href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

function categoryLabel(
  c: FeedItem["category"],
  locale: "en" | "zh",
): string {
  const labels: Record<FeedItem["category"], { en: string; zh: string }> = {
    safety: { en: "Safety", zh: "安全" },
    checkin: { en: "Check-in", zh: "记录" },
    treatment: { en: "Treatment", zh: "治疗" },
    task: { en: "Task", zh: "任务" },
    weather: { en: "Weather", zh: "天气" },
    body: { en: "Body", zh: "身体" },
    trend: { en: "Trend", zh: "趋势" },
    encouragement: { en: "Going well", zh: "进展良好" },
  };
  return labels[c][locale];
}
