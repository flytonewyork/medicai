"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { useUIStore } from "~/stores/ui-store";
import { useLocale, useT } from "~/hooks/use-translate";
import { useSettings } from "~/hooks/use-settings";
import { runEngineAndPersist } from "~/lib/rules/engine";
import { fortnightlyAssessmentSchema } from "~/lib/validators/schemas";
import { todayISO } from "~/lib/utils/date";
import { Alert } from "~/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { SectionHeader } from "~/components/ui/page-header";
import { Button } from "~/components/ui/button";
import { EcogSelfReport } from "./ecog-self-report";
import { MeasurementInput } from "./measurement-input";
import { NeuropathyGradeInput } from "./neuropathy-grade-input";
import { SarcF } from "./sarc-f";
import { scoreSarcF } from "~/lib/calculations/sarcopenia";

type EcogLevel = 0 | 1 | 2 | 3 | 4;

interface FormState {
  assessment_date: string;
  ecog_self: EcogLevel;
  grip_dominant_kg?: number;
  grip_nondominant_kg?: number;
  gait_speed_ms?: number;
  sit_to_stand_30s?: number;
  muac_cm?: number;
  calf_circumference_cm?: number;
  neuropathy_grade?: EcogLevel;
  distress_thermometer?: number;
  sarc_f_responses?: number[];
  tug_seconds?: number;
  single_leg_stance_seconds?: number;
  sts_5x_seconds?: number;
  walk_6min_meters?: number;
}

const EMPTY: FormState = {
  assessment_date: todayISO(),
  ecog_self: 1,
};

export function FortnightlyForm({ entryId }: { entryId?: number }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const enteredBy = useUIStore((s) => s.enteredBy);
  const baseline = useSettings();

  const existing = useLiveQuery(
    () => (entryId ? db.fortnightly_assessments.get(entryId) : undefined),
    [entryId],
  );

  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setForm({
        assessment_date: existing.assessment_date,
        ecog_self: existing.ecog_self,
        grip_dominant_kg: existing.grip_dominant_kg,
        grip_nondominant_kg: existing.grip_nondominant_kg,
        gait_speed_ms: existing.gait_speed_ms,
        sit_to_stand_30s: existing.sit_to_stand_30s,
        muac_cm: existing.muac_cm,
        calf_circumference_cm: existing.calf_circumference_cm,
        neuropathy_grade: existing.neuropathy_grade,
        distress_thermometer: existing.distress_thermometer,
        sarc_f_responses: existing.sarc_f_responses,
        tug_seconds: existing.tug_seconds,
        single_leg_stance_seconds: existing.single_leg_stance_seconds,
        sts_5x_seconds: existing.sts_5x_seconds,
        walk_6min_meters: existing.walk_6min_meters,
      });
    }
  }, [existing]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const sarcFilled =
        form.sarc_f_responses && form.sarc_f_responses.length === 5;
      const parsed = fortnightlyAssessmentSchema.safeParse({
        ...form,
        entered_by: enteredBy,
        sarc_f_total: sarcFilled ? scoreSarcF(form.sarc_f_responses!) : undefined,
      });
      if (!parsed.success) {
        setError(parsed.error.issues.map((i) => i.message).join(", "));
        return;
      }
      const payload = {
        ...parsed.data,
        entered_at: now(),
        created_at: existing?.created_at ?? now(),
        updated_at: now(),
      };
      if (entryId) {
        await db.fortnightly_assessments.update(entryId, payload);
      } else {
        await db.fortnightly_assessments.add(payload);
      }
      await runEngineAndPersist();
      router.push("/fortnightly");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "ECOG 自评" : "ECOG self-report"}
          </CardTitle>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {locale === "zh"
              ? "选择最贴近你过去一周活动水平的一项。"
              : "Choose the row that best matches your activity level over the past week."}
          </div>
        </CardHeader>
        <CardContent>
          <EcogSelfReport
            value={form.ecog_self}
            onChange={(v) => update("ecog_self", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "功能测试" : "Functional tests"}
          </CardTitle>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {locale === "zh"
              ? "每两周一次，清晨完成。若有疑问请向临床团队求助。"
              : "Every two weeks, ideally in the morning. Ask the clinical team if uncertain."}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <MeasurementInput
            label={locale === "zh" ? "握力（惯用手）" : "Grip — dominant"}
            unit="kg"
            value={form.grip_dominant_kg}
            baseline={baseline?.baseline_grip_dominant_kg}
            step={0.5}
            min={0}
            max={100}
            goodDirection="higher"
            onChange={(v) => update("grip_dominant_kg", v)}
            howTo={
              locale === "zh" ? (
                <>
                  使用 Jamar 或 Camry 握力器。坐位，肘部 90°，手臂不依靠。全力挤压 3
                  秒，取三次最大值。换手休息 15 秒。
                </>
              ) : (
                <>
                  Jamar / Camry dynamometer. Seated, elbow 90°, arm unsupported.
                  Squeeze hard for 3 s. Take the best of 3 attempts, 15 s rest between.
                </>
              )
            }
          />
          <MeasurementInput
            label={locale === "zh" ? "握力（非惯用手）" : "Grip — non-dominant"}
            unit="kg"
            value={form.grip_nondominant_kg}
            baseline={baseline?.baseline_grip_nondominant_kg}
            step={0.5}
            min={0}
            max={100}
            goodDirection="higher"
            onChange={(v) => update("grip_nondominant_kg", v)}
          />
          <MeasurementInput
            label={locale === "zh" ? "4 米步速" : "4 m gait speed"}
            unit="m/s"
            value={form.gait_speed_ms}
            baseline={baseline?.baseline_gait_speed_ms}
            step={0.05}
            min={0}
            max={3}
            goodDirection="higher"
            onChange={(v) => update("gait_speed_ms", v)}
            howTo={
              locale === "zh" ? (
                <>
                  在平地标出 4 米。从静止开始，以平常步速走完。用手机秒表记时，米 /
                  秒 = 4 ÷ 秒数。取两次平均。
                </>
              ) : (
                <>
                  Mark 4 m on level ground. Start from standing, walk at usual pace.
                  Phone stopwatch. m/s = 4 ÷ seconds. Average of two trials.
                </>
              )
            }
          />
          <MeasurementInput
            label={locale === "zh" ? "30 秒坐立" : "30-s sit-to-stand"}
            unit={locale === "zh" ? "次" : "reps"}
            value={form.sit_to_stand_30s}
            baseline={baseline?.baseline_sit_to_stand}
            step={1}
            min={0}
            max={50}
            goodDirection="higher"
            onChange={(v) => update("sit_to_stand_30s", v)}
            howTo={
              locale === "zh" ? (
                <>
                  标准椅（约 43 cm 高）。双臂交叉胸前。30
                  秒内完整坐下—站起的次数（每次站直算一次）。
                </>
              ) : (
                <>
                  Standard chair (~43 cm). Arms crossed over chest. Count complete
                  stand-to-sit cycles in 30 s (full upright stand = one rep).
                </>
              )
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "人体测量" : "Anthropometrics"}
          </CardTitle>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {locale === "zh"
              ? "肌肉质量的代用指标。用卷尺测量，精确到 0.5 cm。"
              : "Proxies for muscle mass. Use a soft tape, nearest 0.5 cm."}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <MeasurementInput
            label={locale === "zh" ? "上臂围 (MUAC)" : "Mid-upper arm (MUAC)"}
            unit="cm"
            value={form.muac_cm}
            baseline={baseline?.baseline_muac_cm}
            step={0.5}
            min={15}
            max={50}
            goodDirection="higher"
            onChange={(v) => update("muac_cm", v)}
            howTo={
              locale === "zh" ? (
                <>
                  非惯用手。肩峰与鹰嘴中点，手臂自然下垂。水平绕一圈，不要压紧皮肤。
                </>
              ) : (
                <>
                  Non-dominant arm. Midpoint between acromion and olecranon, arm
                  hanging relaxed. Tape horizontal, snug but not compressing.
                </>
              )
            }
          />
          <MeasurementInput
            label={locale === "zh" ? "小腿围" : "Calf circumference"}
            unit="cm"
            value={form.calf_circumference_cm}
            baseline={baseline?.baseline_calf_cm}
            step={0.5}
            min={20}
            max={60}
            goodDirection="higher"
            onChange={(v) => update("calf_circumference_cm", v)}
            howTo={
              locale === "zh" ? (
                <>坐位，膝盖 90°，脚平放。在小腿最粗处水平绕一圈。</>
              ) : (
                <>Seated, knee at 90°, foot flat. Tape horizontally at widest part of calf.</>
              )
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh"
              ? "其他功能测试（可选）"
              : "Additional function tests (optional)"}
          </CardTitle>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {locale === "zh"
              ? "可在家里安全完成 —— 身边最好有人照看。"
              : "All safe to do at home — ideally with a spotter nearby."}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <MeasurementInput
            label={locale === "zh" ? "Timed Up-and-Go" : "Timed Up-and-Go"}
            unit="s"
            value={form.tug_seconds}
            step={0.5}
            min={0}
            max={60}
            goodDirection="lower"
            onChange={(v) => update("tug_seconds", v)}
            howTo={
              locale === "zh" ? (
                <>
                  标准椅。从坐位开始，按平常速度站起、走 3
                  米、转身、走回、坐下。手机秒表。正常 &lt; 12 秒；&gt; 14
                  秒提示跌倒风险升高。
                </>
              ) : (
                <>
                  Standard chair. Stand from seated, walk 3 m at normal pace,
                  turn, walk back, sit down. Phone stopwatch. &lt;12 s is normal;
                  &gt;14 s suggests elevated fall risk.
                </>
              )
            }
          />
          <MeasurementInput
            label={locale === "zh" ? "5 次坐立" : "5× sit-to-stand"}
            unit="s"
            value={form.sts_5x_seconds}
            step={0.5}
            min={0}
            max={60}
            goodDirection="lower"
            onChange={(v) => update("sts_5x_seconds", v)}
            howTo={
              locale === "zh" ? (
                <>
                  标准椅，双臂交叉胸前。计时完成 5 次完整的坐—站循环。&gt; 15
                  秒提示肌力低下。
                </>
              ) : (
                <>
                  Standard chair, arms crossed. Time 5 complete sit-to-stand
                  cycles. &gt;15 s suggests low muscle strength.
                </>
              )
            }
          />
          <MeasurementInput
            label={locale === "zh" ? "单腿站立" : "Single-leg stance"}
            unit="s"
            value={form.single_leg_stance_seconds}
            step={1}
            min={0}
            max={60}
            goodDirection="higher"
            onChange={(v) => update("single_leg_stance_seconds", v)}
            howTo={
              locale === "zh" ? (
                <>
                  双手叉腰，抬起一只脚离地，睁眼计时到失衡为止。取两侧较差的一次，最大 30 秒。&lt; 10 秒提示平衡不佳。
                </>
              ) : (
                <>
                  Hands on hips, lift one foot, eyes open. Time until loss of
                  balance. Record the worse side, cap at 30 s. &lt;10 s suggests
                  poor balance.
                </>
              )
            }
          />
          <MeasurementInput
            label={locale === "zh" ? "6 分钟步行" : "6-minute walk"}
            unit="m"
            value={form.walk_6min_meters}
            step={5}
            min={0}
            max={900}
            goodDirection="higher"
            onChange={(v) => update("walk_6min_meters", v)}
            howTo={
              locale === "zh" ? (
                <>
                  在平地标出 30 米往返，或用跑步机 / 走廊。按自己节奏走 6
                  分钟，累加距离。可以停下休息但计时不停。&gt; 400
                  米为可接受；明显下降要讨论。
                </>
              ) : (
                <>
                  Mark a 30 m course or use a treadmill / corridor. Walk at own
                  pace for 6 minutes, summing distance. Rest allowed but timer
                  runs. &gt;400 m is reasonable; any clear drop is a discussion
                  point.
                </>
              )
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SARC-F</CardTitle>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {locale === "zh"
              ? "5 个问题的肌少症筛查（每题 0–2 分）。总分 ≥ 4 建议进一步评估。"
              : "5-question sarcopenia screen (0–2 per item). Total ≥ 4 flags the need for further assessment."}
          </div>
        </CardHeader>
        <CardContent>
          <SarcF
            responses={form.sarc_f_responses}
            onChange={(responses) => update("sarc_f_responses", responses)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "周围神经病变分级" : "Neuropathy grade"}
          </CardTitle>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {locale === "zh"
              ? "选择最严重的一项 —— 手或脚的症状，无论哪一侧。"
              : "Pick the worst — hands or feet, either side. CTCAE-aligned."}
          </div>
        </CardHeader>
        <CardContent>
          <NeuropathyGradeInput
            value={form.neuropathy_grade}
            onChange={(v) => update("neuropathy_grade", v)}
          />
        </CardContent>
      </Card>

      {error && <Alert variant="warn">{error}</Alert>}

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => router.push("/fortnightly")}>
          {t("common.cancel")}
        </Button>
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>

      <SectionHeader
        title={locale === "zh" ? "为何要做这些" : "Why these matter"}
        description={
          locale === "zh"
            ? "这些指标量化 ECOG 的第三轴 —— 治疗相关的身体储备消耗。早发现，才能早调整。"
            : "These quantify ECOG's third axis — treatment-driven erosion of physical reserve. Early detection enables dose levers before PS crosses a threshold."
        }
      />
    </div>
  );
}
