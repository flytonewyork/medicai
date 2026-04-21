"use client";

import { cn } from "~/lib/utils/cn";
import { useLocale } from "~/hooks/use-translate";

const PHQ9_ITEMS_EN = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure",
  "Trouble concentrating on things",
  "Moving or speaking so slowly, or being fidgety/restless",
  "Thoughts that you would be better off dead, or of hurting yourself",
];
const PHQ9_ITEMS_ZH = [
  "做事时提不起劲或没有兴趣",
  "感到心情低落、沮丧或绝望",
  "入睡困难、难以保持睡眠或睡眠过多",
  "感到疲倦或没有活力",
  "食欲不振或吃太多",
  "觉得自己糟糕，或觉得自己是个失败者",
  "对事物专注有困难",
  "动作或说话缓慢到别人察觉，或相反地坐立不安",
  "有不如死掉或伤害自己的念头",
];
const GAD7_ITEMS_EN = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen",
];
const GAD7_ITEMS_ZH = [
  "感到紧张、焦虑或烦躁",
  "无法停止或控制忧虑",
  "对各种事情过度忧虑",
  "很难放松下来",
  "坐立不安，难以安静地坐着",
  "变得容易烦躁或易怒",
  "感到害怕，好像有可怕的事情会发生",
];

const RESPONSE_EN = [
  "Not at all",
  "Several days",
  "More than half the days",
  "Nearly every day",
];
const RESPONSE_ZH = ["完全没有", "好几天", "一半以上的日子", "几乎每天"];

export function PhqGad({
  items,
  responses,
  onChange,
  kind,
}: {
  items: string[];
  responses: number[];
  onChange: (v: number[]) => void;
  kind: "phq9" | "gad7";
}) {
  const locale = useLocale();
  const responseLabels = locale === "zh" ? RESPONSE_ZH : RESPONSE_EN;
  return (
    <div className="space-y-3">
      {items.map((q, i) => {
        const value = responses[i];
        return (
          <div
            key={i}
            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="text-sm text-slate-800 dark:text-slate-200">
              {i + 1}. {q}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((r) => {
                const active = value === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      const next = responses.slice();
                      next[i] = r;
                      onChange(next);
                    }}
                    className={cn(
                      "rounded-md border px-1 py-2 text-[11px] font-medium leading-tight",
                      active
                        ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                        : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400",
                    )}
                    aria-pressed={active}
                  >
                    {responseLabels[r]}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Phq9({
  responses,
  onChange,
}: {
  responses: number[];
  onChange: (v: number[]) => void;
}) {
  const locale = useLocale();
  return (
    <PhqGad
      items={locale === "zh" ? PHQ9_ITEMS_ZH : PHQ9_ITEMS_EN}
      responses={responses}
      onChange={onChange}
      kind="phq9"
    />
  );
}

export function Gad7({
  responses,
  onChange,
}: {
  responses: number[];
  onChange: (v: number[]) => void;
}) {
  const locale = useLocale();
  return (
    <PhqGad
      items={locale === "zh" ? GAD7_ITEMS_ZH : GAD7_ITEMS_EN}
      responses={responses}
      onChange={onChange}
      kind="gad7"
    />
  );
}

// FACIT-Sp-12 — shortened 8-item version (Meaning/Peace + Faith subscales)
const FACITSP_EN = [
  { text: "I feel peaceful.", subscale: "peace" },
  { text: "I have a reason for living.", subscale: "meaning" },
  { text: "My life has been productive.", subscale: "meaning" },
  { text: "I have trouble feeling peace of mind.", subscale: "peace", reverse: true },
  { text: "I feel a sense of purpose in my life.", subscale: "meaning" },
  { text: "I am able to reach down deep into myself for comfort.", subscale: "faith" },
  { text: "I find comfort in my faith or spiritual beliefs.", subscale: "faith" },
  { text: "My illness has strengthened my faith or spiritual beliefs.", subscale: "faith" },
];
const FACITSP_ZH = [
  { text: "我感到内心平静。", subscale: "peace" },
  { text: "我有活下去的理由。", subscale: "meaning" },
  { text: "我的生命是有成果的。", subscale: "meaning" },
  { text: "我难以获得内心的安宁。", subscale: "peace", reverse: true },
  { text: "我感到自己的生命有意义。", subscale: "meaning" },
  { text: "我能深入内心找到安慰。", subscale: "faith" },
  { text: "我在信仰 / 灵性中找到安慰。", subscale: "faith" },
  { text: "这次生病让我的信仰 / 灵性更坚定。", subscale: "faith" },
];

const FACIT_RESPONSE_EN = [
  "Not at all",
  "A little",
  "Somewhat",
  "Quite a bit",
  "Very much",
];
const FACIT_RESPONSE_ZH = ["完全没有", "一点点", "有些", "相当多", "非常多"];

export function FacitSp({
  responses,
  onChange,
}: {
  responses: number[];
  onChange: (v: number[]) => void;
}) {
  const locale = useLocale();
  const items = locale === "zh" ? FACITSP_ZH : FACITSP_EN;
  const labels = locale === "zh" ? FACIT_RESPONSE_ZH : FACIT_RESPONSE_EN;
  return (
    <div className="space-y-3">
      {items.map((q, i) => {
        const value = responses[i];
        return (
          <div
            key={i}
            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="text-sm text-slate-800 dark:text-slate-200">
              {i + 1}. {q.text}
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {[0, 1, 2, 3, 4].map((r) => {
                const active = value === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      const next = responses.slice();
                      next[i] = r;
                      onChange(next);
                    }}
                    className={cn(
                      "rounded-md border px-1 py-1.5 text-[11px] font-medium leading-tight",
                      active
                        ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                        : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400",
                    )}
                    aria-pressed={active}
                  >
                    {labels[r]}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function scoreFacitSp(responses: number[]): {
  total: number;
  meaning_peace: number;
  faith: number;
} {
  // Items 0,1,2,3 are meaning/peace (with 3 reversed); 5,6,7 are faith; 4 is meaning.
  // Simplified: sum with reversal on the one marked item (index 3).
  const items = FACITSP_EN;
  let meaning = 0;
  let peace = 0;
  let faith = 0;
  for (let i = 0; i < items.length; i++) {
    const r = responses[i] ?? 0;
    const item = items[i];
    if (!item) continue;
    const score = item.reverse ? 4 - r : r;
    if (item.subscale === "meaning") meaning += score;
    else if (item.subscale === "peace") peace += score;
    else if (item.subscale === "faith") faith += score;
  }
  return {
    meaning_peace: meaning + peace,
    faith,
    total: meaning + peace + faith,
  };
}

export function DistressThermometer({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (n: number) => void;
}) {
  const locale = useLocale();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm font-medium">
        {locale === "zh" ? "痛苦温度计（0–10）" : "Distress thermometer (0–10)"}
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {locale === "zh"
          ? "0 = 没有痛苦，10 = 极度痛苦。涵盖情绪、身体、家庭、实际问题。"
          : "0 = no distress, 10 = extreme distress. Cover emotional, physical, family, practical."}
      </div>
      <div className="mt-3 grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, i) => {
          const active = value === i;
          const tone =
            i >= 7 ? "red-600" : i >= 4 ? "amber-500" : "slate-400";
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              className={cn(
                "h-10 rounded-md border text-sm font-semibold",
                active
                  ? `border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900`
                  : `border-slate-200 dark:border-slate-800 text-${tone}`,
              )}
            >
              {i}
            </button>
          );
        })}
      </div>
    </div>
  );
}
