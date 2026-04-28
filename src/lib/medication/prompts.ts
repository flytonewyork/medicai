// Context-aware medication prompts (2b.1) — cycle-phase rules only.
//
// Each rule reads the active treatment cycle, cycle day, and active medications
// and may emit a single MedicationPrompt. The dashboard card persists the
// prompt's (rule_id, fired_for) tuple to dedupe across renders so an
// acknowledged or dismissed prompt does not re-show within its trigger window.
//
// Rules MUST only assert facts that are backed by a `prompt_facts` entry on
// the relevant DrugInfo. The DrugInfo carries the citation; this file only
// re-shapes those facts into patient-facing copy.
import type {
  DrugInfo,
  DrugReference,
  Medication,
  MedicationPromptEvent,
  ReferenceSource,
} from "~/types/medication";
import type { ProtocolId, TreatmentCycle } from "~/types/treatment";
import type { LocalizedText } from "~/types/localized";

export interface PromptCitation {
  label: string;
  url: string;
  source: ReferenceSource;
  publisher?: string;
}

export type PromptSeverity = "info" | "caution" | "warning";
export type PromptActionKind =
  | "ack"          // patient confirms the prompt has been seen / actioned
  | "log_lab"      // jump to lab logging surface
  | "log_mood"     // jump to mood / wellbeing logging
  | "call_clinic"; // surface clinic phone numbers

export interface PromptAction {
  kind: PromptActionKind;
  label: LocalizedText;
}

export interface MedicationPrompt {
  rule_id: string;
  fired_for: string;
  drug_id: string;
  cycle_id?: number;
  cycle_day?: number;
  severity: PromptSeverity;
  title: LocalizedText;
  body: LocalizedText;
  primary_action: PromptAction;
  secondary_action?: PromptAction;
  citations: PromptCitation[];
}

export interface PromptRuleContext {
  cycle: TreatmentCycle | null;
  cycle_day: number | null;
  protocol_id: ProtocolId | null;
  active_meds: Medication[];
  drugs_by_id: Record<string, DrugInfo>;
  // Persisted events so we can suppress already-resolved prompts.
  existing_events: MedicationPromptEvent[];
}

export interface PromptRule {
  id: string;
  evaluate(ctx: PromptRuleContext): MedicationPrompt | null;
}

// ---- helpers ---------------------------------------------------------------

function isGnpProtocol(p: ProtocolId | null): boolean {
  return (
    p === "gnp_weekly" ||
    p === "gnp_biweekly" ||
    p === "gnp_narmafotinib" ||
    p === "gem_maintenance"
  );
}

function activeDrugIds(meds: Medication[]): Set<string> {
  return new Set(meds.filter((m) => m.active).map((m) => m.drug_id));
}

function citationsFromFact(
  drug: DrugInfo,
  source_refs: number[],
): PromptCitation[] {
  const refs = drug.references ?? [];
  return source_refs
    .map((i): DrugReference | undefined => refs[i])
    .filter((r): r is DrugReference => Boolean(r))
    .map((r) => ({
      label: r.section ? `${r.publisher ?? r.source} — ${r.section}` : r.title,
      url: r.url,
      source: r.source,
      publisher: r.publisher,
    }));
}

// ---- rule: gnp_d8_predose_bloods ------------------------------------------

const GNP_D8_PREDOSE_BLOODS: PromptRule = {
  id: "gnp_d8_predose_bloods",
  evaluate(ctx) {
    if (!ctx.cycle || ctx.cycle_day == null) return null;
    if (!isGnpProtocol(ctx.protocol_id)) return null;
    if (ctx.cycle_day !== 8 && ctx.cycle_day !== 15) return null;

    const drugIds = activeDrugIds(ctx.active_meds);
    const hasGem = drugIds.has("gemcitabine");
    const hasNabP = drugIds.has("nab_paclitaxel");
    if (!hasGem && !hasNabP) return null;

    // Prefer the nab-paclitaxel label as the citation when present (the GnP
    // combination D1/D8/D15 pre-dose CBC requirement is in the Abraxane label).
    const drug = hasNabP
      ? ctx.drugs_by_id["nab_paclitaxel"]
      : ctx.drugs_by_id["gemcitabine"];
    if (!drug?.prompt_facts?.nadir) return null;

    const citations = citationsFromFact(
      drug,
      drug.prompt_facts.nadir.source_refs,
    );

    return {
      rule_id: this.id,
      fired_for: `cycle:${ctx.cycle.id ?? "x"}|day:${ctx.cycle_day}`,
      drug_id: drug.id,
      cycle_id: ctx.cycle.id,
      cycle_day: ctx.cycle_day,
      severity: "caution",
      title: {
        en: `Day ${ctx.cycle_day} — pre-dose bloods needed`,
        zh: `第 ${ctx.cycle_day} 天 —— 需要化疗前查血`,
      },
      body: {
        en: "Pre-dose CBC (and platelets) on D8 and D15 of each 28-day GnP cycle drives whether today's dose is given at full dose, 75%, or held. Confirm bloods have been drawn before infusion.",
        zh: "每 28 天 GnP 周期 D8 与 D15 化疗前需查血常规（含血小板），决定今天的剂量为全量、75% 或暂停。请确认输液前已抽血。",
      },
      primary_action: {
        kind: "ack",
        label: { en: "Bloods done", zh: "已抽血" },
      },
      secondary_action: {
        kind: "log_lab",
        label: { en: "Log result", zh: "记录化验结果" },
      },
      citations,
    };
  },
};

// ---- rule: gnp_nadir_vigilance --------------------------------------------

const GNP_NADIR_VIGILANCE: PromptRule = {
  id: "gnp_nadir_vigilance",
  evaluate(ctx) {
    if (!ctx.cycle || ctx.cycle_day == null) return null;
    if (!isGnpProtocol(ctx.protocol_id)) return null;

    const drug = ctx.drugs_by_id["gemcitabine"];
    if (!drug?.prompt_facts?.nadir) return null;
    const fact = drug.prompt_facts.nadir.value;
    if (ctx.cycle_day < fact.start_day || ctx.cycle_day > fact.end_day) {
      return null;
    }

    const drugIds = activeDrugIds(ctx.active_meds);
    if (!drugIds.has("gemcitabine")) return null;

    const citations = citationsFromFact(
      drug,
      drug.prompt_facts.nadir.source_refs,
    );

    return {
      rule_id: this.id,
      // One acknowledgement per cycle covers the whole nadir window.
      fired_for: `cycle:${ctx.cycle.id ?? "x"}|window:nadir`,
      drug_id: drug.id,
      cycle_id: ctx.cycle.id,
      cycle_day: ctx.cycle_day,
      severity: "warning",
      title: {
        en: "Nadir window — fever is an emergency",
        zh: "骨髓低谷 —— 发热为急症",
      },
      body: {
        en: `Days ${fact.start_day}–${fact.end_day}: ANC and platelets are typically lowest. Temperature ≥ 38.0 °C, chills, rigors, or a sore throat means call the oncology team or attend ED — do not wait.`,
        zh: `第 ${fact.start_day}–${fact.end_day} 天：中性粒细胞与血小板通常处于低谷。体温 ≥ 38.0 °C、寒战、僵直或咽痛即请联系肿瘤团队或前往急诊 —— 请勿等待。`,
      },
      primary_action: {
        kind: "ack",
        label: { en: "Understood", zh: "明白" },
      },
      secondary_action: {
        kind: "call_clinic",
        label: { en: "Call clinic", zh: "联系诊所" },
      },
      citations,
    };
  },
};

// ---- rule: dex_post_pulse_mood --------------------------------------------

const DEX_POST_PULSE_MOOD: PromptRule = {
  id: "dex_post_pulse_mood",
  evaluate(ctx) {
    if (!ctx.cycle || ctx.cycle_day == null) return null;

    const drug = ctx.drugs_by_id["dexamethasone"];
    if (!drug?.prompt_facts?.steroid_crash) return null;
    const fact = drug.prompt_facts.steroid_crash.value;
    if (
      ctx.cycle_day < fact.start_day_post_dose ||
      ctx.cycle_day > fact.end_day_post_dose
    ) {
      return null;
    }

    // Dex shows up as an active medication with a cycle-linked schedule that
    // includes day 1 or 2 of the cycle (chemo-day premed).
    const dexMed = ctx.active_meds.find(
      (m) =>
        m.drug_id === "dexamethasone" &&
        m.active &&
        m.schedule.kind === "cycle_linked" &&
        (m.schedule.cycle_days ?? []).some((d) => d === 1 || d === 2),
    );
    if (!dexMed) return null;

    const citations = citationsFromFact(
      drug,
      drug.prompt_facts.steroid_crash.source_refs,
    );

    return {
      rule_id: this.id,
      fired_for: `cycle:${ctx.cycle.id ?? "x"}|day:${ctx.cycle_day}`,
      drug_id: drug.id,
      cycle_id: ctx.cycle.id,
      cycle_day: ctx.cycle_day,
      severity: "info",
      title: {
        en: `Day ${ctx.cycle_day} — how is your mood and energy?`,
        zh: `第 ${ctx.cycle_day} 天 —— 情绪与精力如何？`,
      },
      body: {
        en: "Days 3–5 after the dexamethasone pulse are when low mood, fatigue, irritability, or sleep disruption most often appear. Vardy et al (2006) reported moderate–severe insomnia in 45% and agitation in 27%. Surface it now so it is on the record.",
        zh: "地塞米松撤药后第 3–5 天最容易出现情绪低落、疲劳、易怒或睡眠紊乱。Vardy 等（2006）报告中-重度失眠 45%、激越 27%。现在记录下来。",
      },
      primary_action: {
        kind: "log_mood",
        label: { en: "Log mood", zh: "记录情绪" },
      },
      secondary_action: {
        kind: "ack",
        label: { en: "Feeling fine", zh: "状态良好" },
      },
      citations,
    };
  },
};

// ---- registry --------------------------------------------------------------

export const PROMPT_RULES: readonly PromptRule[] = [
  GNP_D8_PREDOSE_BLOODS,
  GNP_NADIR_VIGILANCE,
  DEX_POST_PULSE_MOOD,
];

export function evaluatePrompts(
  ctx: PromptRuleContext,
): MedicationPrompt[] {
  const out: MedicationPrompt[] = [];
  for (const rule of PROMPT_RULES) {
    const p = rule.evaluate(ctx);
    if (!p) continue;
    const resolved = ctx.existing_events.some(
      (e) =>
        e.rule_id === p.rule_id &&
        e.fired_for === p.fired_for &&
        (e.status === "acknowledged" || e.status === "dismissed"),
    );
    if (resolved) continue;
    out.push(p);
  }
  return out;
}
