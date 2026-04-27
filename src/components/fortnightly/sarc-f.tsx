"use client";

import { cn } from "~/lib/utils/cn";
import { useLocale } from "~/hooks/use-translate";

const QUESTIONS: Record<
  "en" | "zh",
  Array<{ prompt: string; responses: [string, string, string] }>
> = {
  en: [
    {
      prompt: "Strength — how much difficulty lifting / carrying 5 kg?",
      responses: ["None", "Some", "A lot, or unable"],
    },
    {
      prompt: "Assistance walking — how much difficulty walking across a room?",
      responses: ["None", "Some", "A lot, use aid, or unable"],
    },
    {
      prompt: "Rise from a chair — how much difficulty?",
      responses: ["None", "Some", "A lot, or need help"],
    },
    {
      prompt: "Climb stairs — how much difficulty climbing 10 steps?",
      responses: ["None", "Some", "A lot, or unable"],
    },
    {
      prompt: "Falls — how many times in the past year?",
      responses: ["None", "1–3", "4 or more"],
    },
  ],
  zh: [
    {
      prompt: "力量 —— 提或搬 5 公斤东西的困难程度？",
      responses: ["没有", "有一些", "很多或无法"],
    },
    {
      prompt: "走动 —— 在室内走过一个房间的困难程度？",
      responses: ["没有", "有一些", "很多、需要辅助或无法"],
    },
    {
      prompt: "从椅子上站起 —— 困难程度？",
      responses: ["没有", "有一些", "很多，需要协助"],
    },
    {
      prompt: "爬楼梯 —— 爬 10 级楼梯的困难程度？",
      responses: ["没有", "有一些", "很多或无法"],
    },
    {
      prompt: "跌倒 —— 过去一年跌倒几次？",
      responses: ["没有", "1–3 次", "4 次以上"],
    },
  ],
};

export function SarcF({
  responses,
  onChange,
}: {
  responses: number[] | undefined;
  onChange: (values: number[]) => void;
}) {
  const locale = useLocale();
  const qs = QUESTIONS[locale];
  const values = responses ?? Array(5).fill(0);

  function update(index: number, v: number) {
    const next = values.slice();
    next[index] = v;
    onChange(next);
  }

  const total = values.reduce((a, b) => a + b, 0);
  const positive = total >= 4;

  return (
    <div className="space-y-4">
      {qs.map((q, i) => (
        <div key={i} className="space-y-2">
          <div className="text-sm font-medium text-ink-900">
            {i + 1}. {q.prompt}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {q.responses.map((label, val) => {
              const active = values[i] === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => update(i, val)}
                  className={cn(
                    "h-11 rounded-md border px-2 text-xs font-medium transition-colors",
                    active
                      ? "border-ink-900 bg-ink-900 text-paper"
                      : "border-ink-200 bg-paper-2 text-ink-700 hover:border-ink-300",
                  )}
                  aria-pressed={active}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div
        className={cn(
          "flex items-center justify-between rounded-md border px-3 py-2",
          positive
            ? "border-[var(--warn)]/40 bg-[var(--warn-soft)] text-[var(--warn)]"
            : "border-ink-200 bg-paper-2 text-ink-700",
        )}
      >
        <span className="mono text-[10.5px] uppercase tracking-[0.1em]">
          {locale === "zh" ? "SARC-F 总分" : "SARC-F total"}
        </span>
        <span className="serif text-lg tabular-nums">
          {total} / 10{" "}
          <span className="ml-1 mono text-[10.5px] uppercase tracking-[0.08em]">
            {positive
              ? locale === "zh"
                ? "筛查阳性"
                : "screen positive"
              : locale === "zh"
                ? "筛查阴性"
                : "screen negative"}
          </span>
        </span>
      </div>
    </div>
  );
}
