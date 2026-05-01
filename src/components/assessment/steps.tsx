"use client";

import { useLocale } from "~/hooks/use-translate";
import { EcogSelfReport } from "~/components/fortnightly/ecog-self-report";
import { NeuropathyGradeInput } from "~/components/fortnightly/neuropathy-grade-input";
import { MeasurementInput } from "~/components/fortnightly/measurement-input";
import { SarcF } from "~/components/fortnightly/sarc-f";
import {
  NumberScale,
  OrdinalScale,
  YesNoToggle,
} from "~/components/assessment/inputs";
import {
  DistressThermometer,
  FacitSp,
  Gad7,
  Phq9,
} from "~/components/assessment/questionnaires";
import {
  CountdownTapCounter,
  Stopwatch,
} from "~/components/assessment/timer";
import { Field, TextInput, Textarea } from "~/components/ui/field";
import type {
  ComprehensiveAssessment,
  Settings,
} from "~/types/clinical";

type Patch = <K extends keyof ComprehensiveAssessment>(
  k: K,
  v: ComprehensiveAssessment[K],
) => void;

export interface StepProps {
  assessment: Partial<ComprehensiveAssessment>;
  settings: Settings | null;
  patch: Patch;
}

export function Anthropometrics({ assessment, settings, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <MeasurementInput
        label={locale === "zh" ? "体重" : "Weight"}
        unit="kg"
        value={assessment.weight_kg}
        baseline={settings?.baseline_weight_kg}
        step={0.1}
        min={20}
        max={200}
        goodDirection="higher"
        onChange={(v) => patch("weight_kg", v)}
      />
      <MeasurementInput
        label={locale === "zh" ? "身高" : "Height"}
        unit="cm"
        value={assessment.height_cm}
        baseline={settings?.height_cm}
        step={0.5}
        min={100}
        max={230}
        onChange={(v) => patch("height_cm", v)}
      />
      <MeasurementInput
        label={locale === "zh" ? "上臂围 (MUAC)" : "Mid-upper arm (MUAC)"}
        unit="cm"
        value={assessment.muac_cm}
        baseline={settings?.baseline_muac_cm}
        step={0.5}
        min={15}
        max={50}
        goodDirection="higher"
        onChange={(v) => patch("muac_cm", v)}
      />
      <MeasurementInput
        label={locale === "zh" ? "小腿围" : "Calf"}
        unit="cm"
        value={assessment.calf_cm}
        baseline={settings?.baseline_calf_cm}
        step={0.5}
        min={20}
        max={60}
        goodDirection="higher"
        onChange={(v) => patch("calf_cm", v)}
      />
      <MeasurementInput
        label={locale === "zh" ? "腰围" : "Waist"}
        unit="cm"
        value={assessment.waist_cm}
        step={0.5}
        min={40}
        max={200}
        onChange={(v) => patch("waist_cm", v)}
      />
    </div>
  );
}

export function Vitals({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <MeasurementInput
        label={locale === "zh" ? "静息心率" : "Resting heart rate"}
        unit="bpm"
        value={assessment.resting_hr}
        step={1}
        min={30}
        max={200}
        goodDirection="lower"
        onChange={(v) => patch("resting_hr", v)}
      />
      <MeasurementInput
        label={locale === "zh" ? "收缩压" : "Systolic BP"}
        unit="mmHg"
        value={assessment.systolic_bp}
        step={1}
        min={60}
        max={220}
        onChange={(v) => patch("systolic_bp", v)}
      />
      <MeasurementInput
        label={locale === "zh" ? "舒张压" : "Diastolic BP"}
        unit="mmHg"
        value={assessment.diastolic_bp}
        step={1}
        min={30}
        max={140}
        onChange={(v) => patch("diastolic_bp", v)}
      />
      <MeasurementInput
        label="SpO₂"
        unit="%"
        value={assessment.spo2}
        step={1}
        min={60}
        max={100}
        goodDirection="higher"
        onChange={(v) => patch("spo2", v)}
      />
    </div>
  );
}

export function Ecog({ assessment, patch }: StepProps) {
  return (
    <EcogSelfReport
      value={(assessment.ecog_self ?? 1) as 0 | 1 | 2 | 3 | 4}
      onChange={(v) => patch("ecog_self", v)}
    />
  );
}

export function SarcFStep({ assessment, patch }: StepProps) {
  return (
    <SarcF
      responses={assessment.sarc_f_responses}
      onChange={(v) => {
        patch("sarc_f_responses", v);
        patch("sarc_f_total", v.reduce((a, b) => a + b, 0));
      }}
    />
  );
}

export function GripStep({ assessment, settings, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <MeasurementInput
        label={locale === "zh" ? "握力（惯用手）" : "Grip — dominant"}
        unit="kg"
        value={assessment.grip_dominant_kg}
        baseline={settings?.baseline_grip_dominant_kg}
        step={0.5}
        min={0}
        max={100}
        goodDirection="higher"
        onChange={(v) => patch("grip_dominant_kg", v)}
      />
      <MeasurementInput
        label={locale === "zh" ? "握力（非惯用手）" : "Grip — non-dominant"}
        unit="kg"
        value={assessment.grip_nondominant_kg}
        baseline={settings?.baseline_grip_nondominant_kg}
        step={0.5}
        min={0}
        max={100}
        goodDirection="higher"
        onChange={(v) => patch("grip_nondominant_kg", v)}
      />
    </div>
  );
}

// Round to .05 m/s — matches the manual MeasurementInput precision.
function gaitMSFromSeconds(seconds: number, distance = 4): number {
  return Math.round((distance / seconds) * 20) / 20;
}

export function GaitStep({ assessment, settings, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-3">
      <Stopwatch
        value={
          assessment.gait_speed_ms && assessment.gait_speed_ms > 0
            ? Math.round((4 / assessment.gait_speed_ms) * 10) / 10
            : undefined
        }
        onChange={(s) => {
          if (typeof s === "number" && s > 0) {
            patch("gait_speed_ms", gaitMSFromSeconds(s, 4));
          } else {
            patch("gait_speed_ms", undefined);
          }
        }}
        precision={1}
      />
      <MeasurementInput
        label={locale === "zh" ? "或直接输入步速" : "Or enter gait speed directly"}
        unit="m/s"
        value={assessment.gait_speed_ms}
        baseline={settings?.baseline_gait_speed_ms}
        step={0.05}
        min={0}
        max={3}
        goodDirection="higher"
        onChange={(v) => patch("gait_speed_ms", v)}
      />
    </div>
  );
}

export function Sts30Step({ assessment, settings, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-3">
      <CountdownTapCounter
        durationSeconds={30}
        value={assessment.sit_to_stand_30s}
        onChange={(n) => patch("sit_to_stand_30s", n)}
        tapLabel={locale === "zh" ? "完成一次坐立 +1" : "Tap on each full sit-to-stand"}
        unit={locale === "zh" ? "次" : "reps"}
      />
      <MeasurementInput
        label={locale === "zh" ? "或直接输入次数" : "Or enter reps directly"}
        unit={locale === "zh" ? "次" : "reps"}
        value={assessment.sit_to_stand_30s}
        baseline={settings?.baseline_sit_to_stand}
        step={1}
        min={0}
        max={50}
        goodDirection="higher"
        onChange={(v) => patch("sit_to_stand_30s", v)}
      />
    </div>
  );
}

export function Sts5xStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-3">
      <Stopwatch
        value={assessment.sts_5x_seconds}
        onChange={(s) => patch("sts_5x_seconds", s)}
        precision={1}
      />
      <MeasurementInput
        label={locale === "zh" ? "或直接输入秒数" : "Or enter seconds directly"}
        unit="s"
        value={assessment.sts_5x_seconds}
        step={0.5}
        min={0}
        max={60}
        goodDirection="lower"
        onChange={(v) => patch("sts_5x_seconds", v)}
      />
    </div>
  );
}

export function TugStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-3">
      <Stopwatch
        value={assessment.tug_seconds}
        onChange={(s) => patch("tug_seconds", s)}
        precision={1}
      />
      <MeasurementInput
        label={locale === "zh" ? "或直接输入秒数" : "Or enter seconds directly"}
        unit="s"
        value={assessment.tug_seconds}
        step={0.5}
        min={0}
        max={60}
        goodDirection="lower"
        onChange={(v) => patch("tug_seconds", v)}
      />
    </div>
  );
}

export function SingleLegStanceStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-3">
      <Stopwatch
        value={assessment.single_leg_stance_seconds}
        onChange={(s) => patch("single_leg_stance_seconds", s)}
        maxSeconds={60}
        precision={1}
      />
      <MeasurementInput
        label={locale === "zh" ? "或直接输入秒数" : "Or enter seconds directly"}
        unit="s"
        value={assessment.single_leg_stance_seconds}
        step={1}
        min={0}
        max={60}
        goodDirection="higher"
        onChange={(v) => patch("single_leg_stance_seconds", v)}
      />
    </div>
  );
}

export function Walk6MinStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-3">
      <CountdownTapCounter
        durationSeconds={360}
        value={assessment.walk_6min_meters}
        onChange={(n) => patch("walk_6min_meters", n)}
        increment={30}
        tapLabel={locale === "zh" ? "经过标记点 +30 米" : "Tap at each cone (+30 m)"}
        unit="m"
      />
      <MeasurementInput
        label={locale === "zh" ? "或直接输入米数" : "Or enter metres directly"}
        unit="m"
        value={assessment.walk_6min_meters}
        step={5}
        min={0}
        max={900}
        goodDirection="higher"
        onChange={(v) => patch("walk_6min_meters", v)}
      />
    </div>
  );
}

export function PainStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-4">
      <NumberScale
        label={locale === "zh" ? "过去 24 小时最痛" : "Worst pain in past 24 h"}
        value={assessment.pain_worst}
        onChange={(n) => patch("pain_worst", n)}
        leftLabel={locale === "zh" ? "无痛" : "no pain"}
        rightLabel={locale === "zh" ? "最痛" : "worst pain"}
      />
      <NumberScale
        label={locale === "zh" ? "目前疼痛" : "Pain right now"}
        value={assessment.pain_current}
        onChange={(n) => patch("pain_current", n)}
      />
      <NumberScale
        label={locale === "zh" ? "对活动的影响" : "Interference with activity"}
        value={assessment.pain_interference}
        onChange={(n) => patch("pain_interference", n)}
        leftLabel={locale === "zh" ? "不影响" : "none"}
        rightLabel={locale === "zh" ? "完全影响" : "completely"}
      />
      <Field label={locale === "zh" ? "部位" : "Location"}>
        <TextInput
          value={assessment.pain_location ?? ""}
          onChange={(e) => patch("pain_location", e.target.value)}
          placeholder={locale === "zh" ? "例如：上腹 / 腰背" : "e.g. upper abdomen / mid-back"}
        />
      </Field>
      <Field label={locale === "zh" ? "性质" : "Character"}>
        <TextInput
          value={assessment.pain_character ?? ""}
          onChange={(e) => patch("pain_character", e.target.value)}
          placeholder={locale === "zh" ? "例如：钝痛、刺痛、放射" : "e.g. dull, sharp, radiating"}
        />
      </Field>
    </div>
  );
}

export function FatigueStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-4">
      <NumberScale
        label={locale === "zh" ? "疲劳严重度（过去一周）" : "Fatigue severity (past week)"}
        value={assessment.fatigue_severity}
        onChange={(n) => patch("fatigue_severity", n)}
        leftLabel={locale === "zh" ? "没有" : "none"}
        rightLabel={locale === "zh" ? "非常严重" : "very severe"}
      />
      <NumberScale
        label={locale === "zh" ? "疲劳对活动的影响" : "Interference with activity"}
        value={assessment.fatigue_interference}
        onChange={(n) => patch("fatigue_interference", n)}
      />
    </div>
  );
}

const FREQ_OPTS_EN = ["None", "Rarely", "Sometimes", "Often", "Almost always"];
const FREQ_OPTS_ZH = ["没有", "很少", "有时", "经常", "几乎总是"];

export function GiStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  const opts = locale === "zh" ? FREQ_OPTS_ZH : FREQ_OPTS_EN;
  return (
    <div className="space-y-4">
      <NumberScale
        label={locale === "zh" ? "食欲（0 = 没胃口）" : "Appetite (0 = none)"}
        value={assessment.appetite_rating}
        onChange={(n) => patch("appetite_rating", n)}
      />
      <NumberScale
        label={locale === "zh" ? "恶心严重度" : "Nausea severity"}
        value={assessment.nausea_severity}
        onChange={(n) => patch("nausea_severity", n)}
      />
      <OrdinalScale
        label={locale === "zh" ? "呕吐频率" : "Vomiting frequency"}
        value={assessment.vomiting_frequency}
        onChange={(n) => patch("vomiting_frequency", n)}
        options={opts}
      />
      <OrdinalScale
        label={locale === "zh" ? "腹泻频率" : "Diarrhoea frequency"}
        value={assessment.diarrhoea_frequency}
        onChange={(n) => patch("diarrhoea_frequency", n)}
        options={opts}
      />
      <NumberScale
        label={locale === "zh" ? "便秘严重度" : "Constipation severity"}
        value={assessment.constipation_severity}
        onChange={(n) => patch("constipation_severity", n)}
      />
      <YesNoToggle
        label={locale === "zh" ? "黄疸（皮肤 / 眼睛黄）" : "Jaundice (yellow skin / eyes)"}
        value={assessment.jaundice}
        onChange={(v) => patch("jaundice", v)}
      />
      <NumberScale
        label={locale === "zh" ? "皮肤瘙痒" : "Pruritus"}
        value={assessment.pruritus_severity}
        onChange={(n) => patch("pruritus_severity", n)}
      />
    </div>
  );
}

export function RespiratoryStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  const opts =
    locale === "zh"
      ? ["没有", "爬楼梯时", "平地走时", "穿衣时", "休息时"]
      : [
          "None",
          "On stairs",
          "On level ground",
          "When dressing",
          "At rest",
        ];
  return (
    <div className="space-y-4">
      <OrdinalScale
        label={locale === "zh" ? "气促（活动时）" : "Dyspnoea (on exertion)"}
        value={assessment.dyspnoea_severity}
        onChange={(n) => patch("dyspnoea_severity", n)}
        options={opts}
      />
      <NumberScale
        label={locale === "zh" ? "咳嗽严重度" : "Cough severity"}
        value={assessment.cough_severity}
        onChange={(n) => patch("cough_severity", n)}
      />
    </div>
  );
}

export function ConstitutionalStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-3">
      <YesNoToggle
        label={locale === "zh" ? "近期发热" : "Fever in the past week"}
        value={assessment.fever_recent}
        onChange={(v) => patch("fever_recent", v)}
      />
      <YesNoToggle
        label={locale === "zh" ? "盗汗" : "Night sweats"}
        value={assessment.night_sweats}
        onChange={(v) => patch("night_sweats", v)}
      />
      <YesNoToggle
        label={locale === "zh" ? "非意愿的体重减轻" : "Unintentional weight loss"}
        value={assessment.weight_loss_unintentional}
        onChange={(v) => patch("weight_loss_unintentional", v)}
      />
    </div>
  );
}

export function NeuropathyStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 text-sm font-medium">
          {locale === "zh" ? "手部分级" : "Hands — grade"}
        </div>
        <NeuropathyGradeInput
          value={assessment.neuropathy_hands_grade}
          onChange={(v) => patch("neuropathy_hands_grade", v)}
        />
      </div>
      <div>
        <div className="mb-1 text-sm font-medium">
          {locale === "zh" ? "足部分级" : "Feet — grade"}
        </div>
        <NeuropathyGradeInput
          value={assessment.neuropathy_feet_grade}
          onChange={(v) => patch("neuropathy_feet_grade", v)}
        />
      </div>
    </div>
  );
}

export function MucositisStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-4">
      <NumberScale
        label={locale === "zh" ? "口腔炎 / 溃疡严重度" : "Mucositis severity"}
        value={assessment.mucositis_severity}
        onChange={(n) => patch("mucositis_severity", n)}
      />
      <NumberScale
        label={locale === "zh" ? "遇冷异感强度" : "Cold dysaesthesia"}
        value={assessment.cold_dysaesthesia_severity}
        onChange={(n) => patch("cold_dysaesthesia_severity", n)}
      />
    </div>
  );
}

export function CognitiveStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <NumberScale
      label={locale === "zh" ? "主观认知担忧" : "Subjective cognitive concern"}
      value={assessment.cognitive_concern}
      onChange={(n) => patch("cognitive_concern", n)}
      leftLabel={locale === "zh" ? "没问题" : "none"}
      rightLabel={locale === "zh" ? "明显受损" : "marked"}
    />
  );
}

export function SkinStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-3">
      <YesNoToggle
        label={locale === "zh" ? "皮肤改变（皮疹、脱屑）" : "Skin changes (rash, peeling)"}
        value={assessment.skin_changes}
        onChange={(v) => patch("skin_changes", v)}
      />
      <YesNoToggle
        label={locale === "zh" ? "指甲改变" : "Nail changes"}
        value={assessment.nail_changes}
        onChange={(v) => patch("nail_changes", v)}
      />
      <YesNoToggle
        label={locale === "zh" ? "易淤青 / 出血" : "Easy bruising / bleeding"}
        value={assessment.easy_bruising}
        onChange={(v) => patch("easy_bruising", v)}
      />
    </div>
  );
}

export function Phq9Step({ assessment, patch }: StepProps) {
  const responses = assessment.phq9_responses ?? Array(9).fill(0);
  return (
    <Phq9
      responses={responses}
      onChange={(v) => {
        patch("phq9_responses", v);
        patch("phq9_total", v.reduce((a, b) => a + b, 0));
      }}
    />
  );
}

export function Gad7Step({ assessment, patch }: StepProps) {
  const responses = assessment.gad7_responses ?? Array(7).fill(0);
  return (
    <Gad7
      responses={responses}
      onChange={(v) => {
        patch("gad7_responses", v);
        patch("gad7_total", v.reduce((a, b) => a + b, 0));
      }}
    />
  );
}

export function DistressStep({ assessment, patch }: StepProps) {
  return (
    <DistressThermometer
      value={assessment.distress_thermometer}
      onChange={(n) => patch("distress_thermometer", n)}
    />
  );
}

export function SleepStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-4">
      <NumberScale
        label={locale === "zh" ? "睡眠质量（0 差，10 非常好）" : "Sleep quality (0 poor, 10 excellent)"}
        value={assessment.sleep_quality}
        onChange={(n) => patch("sleep_quality", n)}
      />
      <MeasurementInput
        label={locale === "zh" ? "平均每晚睡眠" : "Average sleep per night"}
        unit="h"
        value={assessment.sleep_hours_average}
        step={0.5}
        min={0}
        max={14}
        onChange={(v) => patch("sleep_hours_average", v)}
      />
    </div>
  );
}

export function FacitSpStep({ assessment, patch }: StepProps) {
  const responses = assessment.facitsp_responses ?? Array(8).fill(0);
  return (
    <FacitSp
      responses={responses}
      onChange={(v) => {
        patch("facitsp_responses", v);
        // simple sum, reversed item handled in scoring helper
        patch("facitsp_total", v.reduce((a, b) => a + b, 0));
      }}
    />
  );
}

export function ValuesPracticeStep({ assessment, patch }: StepProps) {
  const locale = useLocale();
  return (
    <div className="space-y-4">
      <Field
        label={locale === "zh" ? "这段时间最重要的事" : "What matters most this season"}
      >
        <Textarea
          rows={5}
          value={assessment.values_statement ?? ""}
          onChange={(e) => patch("values_statement", e.target.value)}
          placeholder={
            locale === "zh"
              ? "用几句话写下当下最看重的关系、修习、心愿…"
              : "A few sentences on relationships, practice, intentions that matter now."
          }
        />
      </Field>
      <NumberScale
        label={locale === "zh" ? "过去一周修习天数" : "Practice days in past week"}
        value={assessment.practice_days_past_week}
        onChange={(n) => patch("practice_days_past_week", n)}
        min={0}
        max={7}
      />
    </div>
  );
}
