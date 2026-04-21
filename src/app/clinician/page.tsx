"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ZoneBadge } from "~/components/shared/zone-badge";
import { useZoneStatus } from "~/hooks/use-zone-status";
import { useBodyMetrics } from "~/hooks/use-metrics";
import { assessSarcopenia, sarcopeniaLevelLabel } from "~/lib/calculations/sarcopenia";
import { formatDate, todayISO } from "~/lib/utils/date";
import { formatWeekRange } from "~/lib/utils/week";
import { Button } from "~/components/ui/button";
import { FileText } from "lucide-react";

export default function ClinicianPage() {
  const locale = useLocale();
  const { zone, alerts } = useZoneStatus();
  const metrics = useBodyMetrics();

  const settings = useLiveQuery(() => db.settings.toArray());
  const s = settings?.[0];
  const latestFortnightly = useLiveQuery(() =>
    db.fortnightly_assessments
      .orderBy("assessment_date")
      .reverse()
      .limit(1)
      .toArray(),
  );
  const latestWeekly = useLiveQuery(() =>
    db.weekly_assessments.orderBy("week_start").reverse().limit(1).toArray(),
  );
  const labs = useLiveQuery(() =>
    db.labs.orderBy("date").reverse().limit(3).toArray(),
  );
  const lastFourteen = useLiveQuery(() =>
    db.daily_entries.orderBy("date").reverse().limit(14).toArray(),
  );
  const pending = useLiveQuery(() =>
    db.pending_results.toArray(),
  );
  const openPending = (pending ?? []).filter((p) => !p.received);

  const sarcopenia = assessSarcopenia(
    latestFortnightly?.[0] ?? null,
    s ?? null,
  );

  const dailies = lastFourteen ?? [];
  const feverDays = dailies.filter((d) => d.fever).length;
  const avg = (f: (d: (typeof dailies)[number]) => number | undefined) => {
    const vals = dailies
      .map(f)
      .filter((v): v is number => typeof v === "number");
    return vals.length
      ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
      : "—";
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "医师概览（只读）" : "Clinician overview (read-only)"}
        subtitle={
          locale === "zh"
            ? "面向 Dr Lee 的临床快览。所有字段以临床术语呈现。"
            : "Clinician-facing summary in clinical terms. All data is local to this device."
        }
        action={
          <Link href="/reports">
            <Button variant="secondary">
              <FileText className="h-4 w-4" />
              {locale === "zh" ? "下载 PDF" : "Download PDF"}
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Patient</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <InfoPair label="Name" value={s?.profile_name ?? "—"} />
          <InfoPair label="DOB" value={s?.dob ? formatDate(s.dob) : "—"} />
          <InfoPair
            label="Dx date"
            value={s?.diagnosis_date ? formatDate(s.diagnosis_date) : "—"}
          />
          <InfoPair
            label="Oncologist"
            value={s?.managing_oncologist ?? "—"}
          />
          <InfoPair
            label="Current zone"
            value={<ZoneBadge zone={zone} />}
          />
          <InfoPair
            label="Active alerts"
            value={String(alerts.length)}
          />
          <InfoPair
            label="Sarcopenia"
            value={sarcopeniaLevelLabel(sarcopenia.level, "en")}
          />
          <InfoPair label="Report date" value={formatDate(todayISO())} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Functional trajectory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1 text-left font-medium">Measure</th>
                  <th className="py-1 text-left font-medium">Baseline</th>
                  <th className="py-1 text-left font-medium">Latest</th>
                </tr>
              </thead>
              <tbody>
                <FRow
                  label="Weight"
                  unit="kg"
                  baseline={s?.baseline_weight_kg}
                  latest={metrics.latestWeight}
                />
                <FRow
                  label="Grip (dominant)"
                  unit="kg"
                  baseline={s?.baseline_grip_dominant_kg}
                  latest={latestFortnightly?.[0]?.grip_dominant_kg}
                />
                <FRow
                  label="Gait speed"
                  unit="m/s"
                  baseline={s?.baseline_gait_speed_ms}
                  latest={latestFortnightly?.[0]?.gait_speed_ms}
                />
                <FRow
                  label="30-s STS"
                  unit="reps"
                  baseline={s?.baseline_sit_to_stand}
                  latest={latestFortnightly?.[0]?.sit_to_stand_30s}
                />
                <FRow
                  label="5× STS"
                  unit="s"
                  latest={latestFortnightly?.[0]?.sts_5x_seconds}
                />
                <FRow
                  label="TUG"
                  unit="s"
                  latest={latestFortnightly?.[0]?.tug_seconds}
                />
                <FRow
                  label="6-min walk"
                  unit="m"
                  latest={latestFortnightly?.[0]?.walk_6min_meters}
                />
                <FRow
                  label="MUAC"
                  unit="cm"
                  baseline={s?.baseline_muac_cm}
                  latest={latestFortnightly?.[0]?.muac_cm}
                />
                <FRow
                  label="Calf"
                  unit="cm"
                  baseline={s?.baseline_calf_cm}
                  latest={latestFortnightly?.[0]?.calf_circumference_cm}
                />
              </tbody>
            </table>
          </div>
          {latestFortnightly?.[0] && (
            <div className="mt-3 text-xs text-slate-500">
              Last assessment:{" "}
              {formatDate(latestFortnightly[0].assessment_date)} · ECOG{" "}
              {latestFortnightly[0].ecog_self}
              {latestFortnightly[0].neuropathy_grade !== undefined &&
                ` · Neuropathy grade ${latestFortnightly[0].neuropathy_grade}`}
              {typeof latestFortnightly[0].sarc_f_total === "number" &&
                ` · SARC-F ${latestFortnightly[0].sarc_f_total}/10`}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>14-day daily averages</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <InfoPair label="Energy" value={`${avg((d) => d.energy)} / 10`} />
          <InfoPair label="Sleep" value={`${avg((d) => d.sleep_quality)} / 10`} />
          <InfoPair label="Pain worst" value={`${avg((d) => d.pain_worst)} / 10`} />
          <InfoPair label="Nausea" value={`${avg((d) => d.nausea)} / 10`} />
          <InfoPair label="Protein" value={`${avg((d) => d.protein_grams)} g/d`} />
          <InfoPair
            label="Walking"
            value={`${avg((d) => d.walking_minutes)} min/d`}
          />
          <InfoPair
            label="Resistance days"
            value={String(dailies.filter((d) => d.resistance_training).length)}
          />
          <InfoPair label="Fever episodes" value={String(feverDays)} />
        </CardContent>
      </Card>

      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active alerts ({alerts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{a.rule_name}</div>
                    <div className="text-xs text-slate-500">{a.recommendation}</div>
                  </div>
                  <ZoneBadge zone={a.zone} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {latestWeekly?.[0] && (
        <Card>
          <CardHeader>
            <CardTitle>
              Weekly — {formatWeekRange(latestWeekly[0].week_start)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="text-slate-700 dark:text-slate-300">
              Practice {latestWeekly[0].practice_full_days} full /{" "}
              {latestWeekly[0].practice_reduced_days} reduced /{" "}
              {latestWeekly[0].practice_skipped_days} skipped. Functional{" "}
              {latestWeekly[0].functional_integrity}/5 · Stillness{" "}
              {latestWeekly[0].cognitive_stillness}/5 · Social{" "}
              {latestWeekly[0].social_practice_integrity}/5
              {latestWeekly[0].energy_trend
                ? ` · Energy ${latestWeekly[0].energy_trend}`
                : ""}
              .
            </div>
            {latestWeekly[0].concerns && (
              <div>
                <span className="font-medium">Concerns: </span>
                {latestWeekly[0].concerns}
              </div>
            )}
            {latestWeekly[0].questions_for_oncologist && (
              <div>
                <span className="font-medium">Questions: </span>
                <span className="whitespace-pre-line">
                  {latestWeekly[0].questions_for_oncologist}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {labs && labs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent labs</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1 text-left">Date</th>
                  <th className="py-1 text-left">CA19-9</th>
                  <th className="py-1 text-left">Hb</th>
                  <th className="py-1 text-left">Neut</th>
                  <th className="py-1 text-left">Plt</th>
                  <th className="py-1 text-left">Alb</th>
                </tr>
              </thead>
              <tbody>
                {labs.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1">{formatDate(l.date)}</td>
                    <td className="py-1">{l.ca199 ?? "—"}</td>
                    <td className="py-1">{l.hemoglobin ?? "—"}</td>
                    <td className="py-1">{l.neutrophils ?? "—"}</td>
                    <td className="py-1">{l.platelets ?? "—"}</td>
                    <td className="py-1">{l.albumin ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {openPending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending results ({openPending.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {openPending.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.test_name}</span>
                  <span className="text-xs text-slate-500">
                    ordered {formatDate(p.ordered_date)}
                    {p.expected_by ? ` · expected ${formatDate(p.expected_by)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
        Read-only clinician view. Patient-entered and may require clinical
        confirmation. Not a substitute for a clinical record.
      </div>
    </div>
  );
}

function InfoPair({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

function FRow({
  label,
  unit,
  baseline,
  latest,
}: {
  label: string;
  unit: string;
  baseline?: number;
  latest?: number;
}) {
  return (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <td className="py-1">{label}</td>
      <td className="py-1">
        {typeof baseline === "number" ? `${baseline} ${unit}` : "—"}
      </td>
      <td className="py-1">
        {typeof latest === "number" ? `${latest} ${unit}` : "—"}
      </td>
    </tr>
  );
}
