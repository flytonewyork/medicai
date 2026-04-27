import type { CycleContext } from "~/types/treatment";
import type { FeedItem } from "~/types/feed";

// Per Cancer Institute NSW (eviq.org.au, Sept 2025): chemotherapy
// stays in body fluids for ~48 hours after each treatment (some
// agents up to 7 days; continuous infusions up to 7 days after
// the last dose). During this window, body fluids — urine, faeces,
// vomit, blood, saliva, semen, vaginal fluid — can contain
// chemotherapy agents and warrant the household precautions in
// /safety/chemo-at-home.
//
// We surface a feed reminder while the patient is in the GnP
// `dose_day` or `post_dose` phases (days 1, 2-3, 8, 9-10, 15,
// 16-ish per protocol) — exactly the 48h-after-each-dose window.
// Outside that window the precautions can be relaxed and the
// nudge stays silent.

export interface ChemoBodyFluidInputs {
  cycleContext: CycleContext | null;
  todayISO: string;
}

export function computeChemoBodyFluidNudges(
  inputs: ChemoBodyFluidInputs,
): FeedItem[] {
  const phase = inputs.cycleContext?.phase?.key;
  if (phase !== "dose_day" && phase !== "post_dose") return [];
  return [
    {
      id: `chemo_body_fluid_${inputs.todayISO}`,
      priority: 38,
      category: "safety",
      tone: "caution",
      title: {
        en: "Body-fluid precautions in effect",
        zh: "正处于体液防护期",
      },
      body: {
        en: "Within ~48 h of treatment, body fluids may contain chemotherapy. Sit when using the toilet, double-flush after use, wear gloves to handle vomit / soiled laundry, no open-mouth kissing, use a barrier for any sex.",
        zh: "用药后 ~48 小时，体液可能含化疗药物。如厕时坐下，使用后盖上马桶盖并按全冲水；处理呕吐物或污染衣物时戴手套；避免深吻；性生活使用保护措施。",
      },
      cta: {
        href: "/safety/chemo-at-home",
        label: { en: "Full precaution list", zh: "完整防护清单" },
      },
      icon: "shield",
      source: "chemo_body_fluid",
    },
  ];
}
