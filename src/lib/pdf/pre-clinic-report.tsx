import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  DailyEntry,
  FortnightlyAssessment,
  LabResult,
  Settings,
  WeeklyAssessment,
  Zone,
  ZoneAlert,
} from "~/types/clinical";
import type { SarcopeniaAssessment } from "~/lib/calculations/sarcopenia";
import { sarcopeniaLevelLabel } from "~/lib/calculations/sarcopenia";
import { formatDate } from "~/lib/utils/date";
import { formatWeekRange } from "~/lib/utils/week";

const palette = {
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate300: "#cbd5e1",
  slate100: "#f1f5f9",
  amber: "#b45309",
  orange: "#c2410c",
  red: "#b91c1c",
};

const zoneColour: Record<Zone, string> = {
  green: palette.slate700,
  yellow: palette.amber,
  orange: palette.orange,
  red: palette.red,
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: palette.slate900,
    lineHeight: 1.4,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: palette.slate300,
    paddingBottom: 10,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: palette.slate500 },
  metaRow: {
    flexDirection: "row",
    marginTop: 6,
    gap: 16,
  },
  metaBlock: { flexDirection: "column" },
  metaLabel: {
    fontSize: 8,
    color: palette.slate500,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: { fontSize: 10, marginTop: 1 },
  section: { marginTop: 14 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: palette.slate500,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  zoneBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    color: "white",
    fontSize: 9,
    fontWeight: 700,
  },
  alertRow: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 6,
  },
  alertName: { fontSize: 10, fontWeight: 700, marginBottom: 1 },
  alertRecommendation: { fontSize: 9, color: palette.slate700 },
  table: {
    borderWidth: 1,
    borderColor: palette.slate300,
    borderRadius: 3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: palette.slate300,
  },
  tableRowLast: {
    flexDirection: "row",
  },
  th: {
    backgroundColor: palette.slate100,
    padding: 4,
    fontSize: 8,
    fontWeight: 700,
    color: palette.slate700,
    flex: 1,
    textTransform: "uppercase",
  },
  td: {
    padding: 4,
    fontSize: 9,
    flex: 1,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 2,
  },
  bulletDot: {
    width: 10,
  },
  bulletText: { flex: 1 },
  footnote: {
    fontSize: 8,
    color: palette.slate500,
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: palette.slate300,
    paddingTop: 6,
  },
});

export interface ReportPayload {
  generatedAt: Date;
  settings: Settings | null;
  currentZone: Zone;
  activeAlerts: ZoneAlert[];
  last14Dailies: DailyEntry[];
  latestFortnightly: FortnightlyAssessment | null;
  priorFortnightly: FortnightlyAssessment | null;
  latestWeekly: WeeklyAssessment | null;
  recentLabs: LabResult[];
  sarcopenia: SarcopeniaAssessment | null;
  autoQuestions: string[];
}

function Zoneable({ zone, label }: { zone: Zone; label: string }) {
  return (
    <Text style={[styles.zoneBadge, { backgroundColor: zoneColour[zone] }]}>
      {label}
    </Text>
  );
}

function Delta({
  current,
  baseline,
  unit,
}: {
  current?: number;
  baseline?: number;
  unit: string;
}) {
  if (typeof current !== "number" && typeof baseline !== "number") {
    return <Text style={styles.td}>—</Text>;
  }
  if (typeof current !== "number") {
    return <Text style={styles.td}>baseline {baseline} {unit}</Text>;
  }
  if (typeof baseline !== "number") {
    return (
      <Text style={styles.td}>
        {current} {unit}
      </Text>
    );
  }
  const pct = ((current - baseline) / baseline) * 100;
  return (
    <Text style={styles.td}>
      {current} {unit} ({pct > 0 ? "+" : ""}
      {pct.toFixed(1)}%)
    </Text>
  );
}

export function PreClinicReport({ data }: { data: ReportPayload }) {
  const { settings } = data;
  const name = settings?.profile_name ?? "Patient";
  const oncologist = settings?.managing_oncologist ?? "—";
  const diagnosisDate = settings?.diagnosis_date;

  const avg = averages(data.last14Dailies);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Pre-clinic summary — {name}</Text>
          <Text style={styles.subtitle}>
            Metastatic pancreatic adenocarcinoma · first-line
            gemcitabine + nab-paclitaxel
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Generated</Text>
              <Text style={styles.metaValue}>
                {formatDate(data.generatedAt.toISOString().slice(0, 10))}
              </Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Oncologist</Text>
              <Text style={styles.metaValue}>{oncologist}</Text>
            </View>
            {diagnosisDate && (
              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>Diagnosis</Text>
                <Text style={styles.metaValue}>{formatDate(diagnosisDate)}</Text>
              </View>
            )}
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Window</Text>
              <Text style={styles.metaValue}>Last 14 days</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current zone</Text>
          <View style={styles.zoneRow}>
            <Zoneable zone={data.currentZone} label={data.currentZone.toUpperCase()} />
            <Text>{data.activeAlerts.length} active alert(s)</Text>
          </View>
        </View>

        {data.activeAlerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active alerts</Text>
            {data.activeAlerts.map((a) => (
              <View
                key={a.id}
                style={[
                  styles.alertRow,
                  { borderLeftColor: zoneColour[a.zone] },
                ]}
              >
                <Text style={styles.alertName}>
                  [{a.zone.toUpperCase()}] {a.rule_name}
                </Text>
                <Text style={styles.alertRecommendation}>
                  {a.recommendation}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Functional trajectory</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.th}>Measure</Text>
              <Text style={styles.th}>Baseline</Text>
              <Text style={styles.th}>Latest</Text>
              <Text style={styles.th}>Prior</Text>
            </View>
            <FuncRow
              label="Weight (kg)"
              baseline={settings?.baseline_weight_kg}
              latest={latestNumeric(data.last14Dailies, "weight_kg")}
              prior={undefined}
              unit="kg"
            />
            <FuncRow
              label="Grip — dominant"
              baseline={settings?.baseline_grip_dominant_kg}
              latest={data.latestFortnightly?.grip_dominant_kg}
              prior={data.priorFortnightly?.grip_dominant_kg}
              unit="kg"
            />
            <FuncRow
              label="Gait speed"
              baseline={settings?.baseline_gait_speed_ms}
              latest={data.latestFortnightly?.gait_speed_ms}
              prior={data.priorFortnightly?.gait_speed_ms}
              unit="m/s"
            />
            <FuncRow
              label="30-s STS"
              baseline={settings?.baseline_sit_to_stand}
              latest={data.latestFortnightly?.sit_to_stand_30s}
              prior={data.priorFortnightly?.sit_to_stand_30s}
              unit="reps"
            />
            <FuncRow
              label="5× STS"
              baseline={undefined}
              latest={data.latestFortnightly?.sts_5x_seconds}
              prior={data.priorFortnightly?.sts_5x_seconds}
              unit="s"
            />
            <FuncRow
              label="TUG"
              baseline={undefined}
              latest={data.latestFortnightly?.tug_seconds}
              prior={data.priorFortnightly?.tug_seconds}
              unit="s"
            />
            <FuncRow
              label="Single-leg stance"
              baseline={undefined}
              latest={data.latestFortnightly?.single_leg_stance_seconds}
              prior={data.priorFortnightly?.single_leg_stance_seconds}
              unit="s"
            />
            <FuncRow
              label="6-min walk"
              baseline={undefined}
              latest={data.latestFortnightly?.walk_6min_meters}
              prior={data.priorFortnightly?.walk_6min_meters}
              unit="m"
            />
            <FuncRow
              label="MUAC"
              baseline={settings?.baseline_muac_cm}
              latest={data.latestFortnightly?.muac_cm}
              prior={data.priorFortnightly?.muac_cm}
              unit="cm"
            />
            <FuncRow
              label="Calf"
              baseline={settings?.baseline_calf_cm}
              latest={data.latestFortnightly?.calf_circumference_cm}
              prior={data.priorFortnightly?.calf_circumference_cm}
              unit="cm"
              last
            />
          </View>
          {data.sarcopenia && (
            <Text style={{ marginTop: 6, fontSize: 9 }}>
              Sarcopenia risk:{" "}
              <Text style={{ fontWeight: 700 }}>
                {sarcopeniaLevelLabel(data.sarcopenia.level, "en")}
              </Text>
              {data.sarcopenia.signals.length > 0 &&
                ` — ${data.sarcopenia.signals.join("; ")}`}
              {typeof data.sarcopenia.sarcfScore === "number" &&
                ` · SARC-F ${data.sarcopenia.sarcfScore}/10`}
              .
            </Text>
          )}
          {data.latestFortnightly?.ecog_self !== undefined && (
            <Text style={{ marginTop: 4, fontSize: 9 }}>
              ECOG self-report:{" "}
              <Text style={{ fontWeight: 700 }}>
                {data.latestFortnightly.ecog_self}
              </Text>
              {data.latestFortnightly.neuropathy_grade !== undefined &&
                ` · Neuropathy grade ${data.latestFortnightly.neuropathy_grade}`}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past 14 days — daily averages</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.th}>Metric</Text>
              <Text style={styles.th}>Mean</Text>
              <Text style={styles.th}>Flags</Text>
            </View>
            <AvgRow label="Energy (0–10)" value={avg.energy} flags="" />
            <AvgRow label="Sleep (0–10)" value={avg.sleep} flags="" />
            <AvgRow label="Appetite (0–10)" value={avg.appetite} flags="" />
            <AvgRow label="Nausea (0–10)" value={avg.nausea} flags="" />
            <AvgRow label="Pain worst (0–10)" value={avg.painWorst} flags="" />
            <AvgRow
              label="Protein (g/day)"
              value={avg.protein}
              flags={
                typeof avg.protein === "number" && avg.protein < 72
                  ? "low — target ≥ 1.2 g/kg"
                  : ""
              }
            />
            <AvgRow
              label="Walking (min/day)"
              value={avg.walking}
              flags=""
            />
            <AvgRow
              label="Practice (sessions/day)"
              value={avg.practice}
              flags=""
              last
            />
          </View>
          <Text style={{ marginTop: 4, fontSize: 9 }}>
            Days logged: {data.last14Dailies.length} / 14. Fever episodes:{" "}
            {data.last14Dailies.filter((d) => d.fever).length}. Resistance
            training: {data.last14Dailies.filter((d) => d.resistance_training).length}{" "}
            days.
          </Text>
        </View>

        {data.latestWeekly && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Weekly — {formatWeekRange(data.latestWeekly.week_start)}
            </Text>
            <Text style={{ fontSize: 9 }}>
              Practice: {data.latestWeekly.practice_full_days} full,{" "}
              {data.latestWeekly.practice_reduced_days} reduced,{" "}
              {data.latestWeekly.practice_skipped_days} skipped. Functional{" "}
              {data.latestWeekly.functional_integrity}/5 · Stillness{" "}
              {data.latestWeekly.cognitive_stillness}/5 · Social{" "}
              {data.latestWeekly.social_practice_integrity}/5
              {data.latestWeekly.energy_trend
                ? ` · Energy trend: ${data.latestWeekly.energy_trend}`
                : ""}
              .
            </Text>
            {data.latestWeekly.concerns && (
              <Text style={{ marginTop: 4, fontSize: 9 }}>
                <Text style={{ fontWeight: 700 }}>Concerns: </Text>
                {data.latestWeekly.concerns}
              </Text>
            )}
          </View>
        )}

        {data.recentLabs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent labs</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.th}>Date</Text>
                <Text style={styles.th}>CA19-9</Text>
                <Text style={styles.th}>Hb</Text>
                <Text style={styles.th}>Neut</Text>
                <Text style={styles.th}>Plt</Text>
                <Text style={styles.th}>Alb</Text>
              </View>
              {data.recentLabs.slice(-5).map((l, i, arr) => (
                <View
                  key={l.id ?? i}
                  style={i === arr.length - 1 ? styles.tableRowLast : styles.tableRow}
                >
                  <Text style={styles.td}>{formatDate(l.date)}</Text>
                  <Text style={styles.td}>{l.ca199 ?? "—"}</Text>
                  <Text style={styles.td}>{l.hemoglobin ?? "—"}</Text>
                  <Text style={styles.td}>{l.neutrophils ?? "—"}</Text>
                  <Text style={styles.td}>{l.platelets ?? "—"}</Text>
                  <Text style={styles.td}>{l.albumin ?? "—"}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Questions for oncologist</Text>
          {allQuestions(data).map((q, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{q}</Text>
            </View>
          ))}
          {allQuestions(data).length === 0 && (
            <Text style={{ fontSize: 9, color: palette.slate500 }}>
              None recorded.
            </Text>
          )}
        </View>

        <Text style={styles.footnote}>
          Personal tracking data generated by Anchor. Not a clinical record.
          Trends only — individual values require clinical interpretation.
        </Text>
      </Page>
    </Document>
  );
}

function FuncRow({
  label,
  baseline,
  latest,
  prior,
  unit,
  last,
}: {
  label: string;
  baseline?: number;
  latest?: number;
  prior?: number;
  unit: string;
  last?: boolean;
}) {
  return (
    <View style={last ? styles.tableRowLast : styles.tableRow}>
      <Text style={styles.td}>{label}</Text>
      <Text style={styles.td}>
        {typeof baseline === "number" ? `${baseline} ${unit}` : "—"}
      </Text>
      <Delta current={latest} baseline={baseline} unit={unit} />
      <Text style={styles.td}>
        {typeof prior === "number" ? `${prior} ${unit}` : "—"}
      </Text>
    </View>
  );
}

function AvgRow({
  label,
  value,
  flags,
  last,
}: {
  label: string;
  value: number | undefined;
  flags: string;
  last?: boolean;
}) {
  return (
    <View style={last ? styles.tableRowLast : styles.tableRow}>
      <Text style={styles.td}>{label}</Text>
      <Text style={styles.td}>
        {typeof value === "number" ? value.toFixed(1) : "—"}
      </Text>
      <Text style={styles.td}>{flags}</Text>
    </View>
  );
}

function latestNumeric(
  entries: DailyEntry[],
  key: "weight_kg" | "steps",
): number | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const v = entries[i]?.[key];
    if (typeof v === "number") return v;
  }
  return undefined;
}

function averages(entries: DailyEntry[]) {
  if (entries.length === 0) {
    return {
      energy: undefined,
      sleep: undefined,
      appetite: undefined,
      nausea: undefined,
      painWorst: undefined,
      protein: undefined,
      walking: undefined,
      practice: undefined,
    };
  }
  const sum = (pick: (d: DailyEntry) => number | undefined) => {
    const vals = entries
      .map(pick)
      .filter((v): v is number => typeof v === "number");
    return vals.length === 0
      ? undefined
      : vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  return {
    energy: sum((d) => d.energy),
    sleep: sum((d) => d.sleep_quality),
    appetite: sum((d) => d.appetite),
    nausea: sum((d) => d.nausea),
    painWorst: sum((d) => d.pain_worst),
    protein: sum((d) => d.protein_grams),
    walking: sum((d) => d.walking_minutes),
    practice: sum(
      (d) =>
        (d.practice_morning_completed ? 1 : 0) +
        (d.practice_evening_completed ? 1 : 0),
    ),
  };
}

function allQuestions(data: ReportPayload): string[] {
  const out: string[] = [];
  if (data.latestWeekly?.questions_for_oncologist) {
    data.latestWeekly.questions_for_oncologist
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((q) => out.push(q));
  }
  for (const q of data.autoQuestions) out.push(q);
  return out;
}
