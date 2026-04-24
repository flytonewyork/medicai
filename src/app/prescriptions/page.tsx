"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import {
  ensureCycleMedications,
  getActiveMedications,
} from "~/lib/medication/active";
import { syncCycleToCalendar } from "~/lib/treatment/calendar-sync";
import { DRUGS_BY_ID } from "~/config/drug-registry";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, TextInput } from "~/components/ui/field";
import type { Medication } from "~/types/medication";
import {
  ArrowLeft,
  Check,
  Pencil,
  Pill,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

// Current-prescriptions view. Lists every active medication (protocol-derived
// + user-added) with inline edit + delete. When the user lands here straight
// after creating a chemo cycle (via `?cycle=<id>&from=treatment-new`), the
// page seeds the cycle's protocol meds first and shows a "Review & confirm"
// banner so the user explicitly approves the generated prescriptions before
// anything is logged against them.

export default function PrescriptionsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const cycleIdParam = params.get("cycle");
  const fromTreatment = params.get("from") === "treatment-new";
  const addingNew = params.get("new") === "1";
  const cycleId = cycleIdParam ? Number(cycleIdParam) : undefined;
  const [seeded, setSeeded] = useState(false);

  const cycle = useLiveQuery(
    () => (cycleId ? db.treatment_cycles.get(cycleId) : undefined),
    [cycleId],
  );

  useEffect(() => {
    if (!cycle) return;
    void (async () => {
      await ensureCycleMedications(cycle);
      // Dose days appear on the schedule as chemo appointments so the
      // calendar is the single source of truth for "what's coming up."
      await syncCycleToCalendar(cycle).catch(() => {
        // Non-fatal — the prescription review screen still works if the
        // sync errors (e.g. Dexie migration still in flight on first load).
      });
      setSeeded(true);
    })();
  }, [cycle]);

  const meds = useLiveQuery(() => getActiveMedications(cycleId), [
    cycleId,
    seeded,
  ]);

  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  const grouped = useMemo(() => {
    const protocolMeds: Medication[] = [];
    const userMeds: Medication[] = [];
    for (const m of meds ?? []) {
      if (m.source === "user_added") userMeds.push(m);
      else protocolMeds.push(m);
    }
    return { protocolMeds, userMeds };
  }, [meds]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={L("Prescriptions", "处方")}
        title={L("Current prescriptions", "当前处方")}
        subtitle={L(
          "Every active medication — protocol-derived and anything you've added. Edit dose, timing, or duration without touching today's log.",
          "所有活动药物 —— 来自方案和自行添加的。可修改剂量、时间、疗程，不影响今日记录。",
        )}
        action={
          <Link href="/prescriptions?new=1">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" />
              {L("Add", "新增")}
            </Button>
          </Link>
        }
      />

      {addingNew && <NewPrescriptionForm locale={locale} />}

      {fromTreatment && cycle && (
        <Card className="border-[var(--tide-2)]/40 bg-[var(--tide-soft)]">
          <CardContent className="space-y-2 p-4">
            <div className="eyebrow text-[var(--tide-2)]">
              {L("Review & confirm", "复核并确认")}
            </div>
            <p className="text-[13px] text-ink-900">
              {L(
                "Anchor has generated these prescriptions from the protocol. Edit anything that doesn't match what your oncologist actually ordered, then continue.",
                "Anchor 已按方案生成这些处方。如与肿瘤科医师实际开具的不符，请先修改后再继续。",
              )}
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => router.push(`/treatment/${cycle.id}`)}
              >
                <Check className="h-3.5 w-3.5" />
                {L("Looks right — continue", "核对无误 — 继续")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => router.push("/treatment")}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {L("Back to treatments", "返回治疗列表")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {meds !== undefined && meds.length === 0 && (
        <Card>
          <CardContent className="space-y-2 p-5 text-center text-[13px] text-ink-500">
            <Pill className="mx-auto h-5 w-5 text-ink-300" />
            <div>
              {L(
                "No active prescriptions. Start a treatment cycle to auto-seed protocol meds, or add one manually.",
                "暂无活动处方。开始一个治疗周期以自动填充方案药物，或手动添加。",
              )}
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Link href="/treatment/new">
                <Button size="sm" variant="secondary">
                  {L("Start a cycle", "开始周期")}
                </Button>
              </Link>
              <Link href="/prescriptions?new=1">
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  {L("Add prescription", "添加处方")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {grouped.protocolMeds.length > 0 && (
        <section className="space-y-2">
          <h2 className="eyebrow">
            {L("Protocol-derived", "方案处方")}
          </h2>
          <ul className="space-y-2">
            {grouped.protocolMeds.map((m) => (
              <PrescriptionRow key={m.id} med={m} locale={locale} />
            ))}
          </ul>
        </section>
      )}

      {grouped.userMeds.length > 0 && (
        <section className="space-y-2">
          <h2 className="eyebrow">
            {L("Added by you", "自行添加")}
          </h2>
          <ul className="space-y-2">
            {grouped.userMeds.map((m) => (
              <PrescriptionRow key={m.id} med={m} locale={locale} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function NewPrescriptionForm({ locale }: { locale: "en" | "zh" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]+/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 40);
      await db.medications.add({
        drug_id: `custom:${slug || "medication"}`,
        display_name: name.trim(),
        category: "other",
        dose: dose.trim() || "—",
        route: "PO",
        schedule: { kind: "prn" },
        source: "user_added",
        active: true,
        notes: notes.trim() || undefined,
        started_on: new Date().toISOString().slice(0, 10),
        created_at: now(),
        updated_at: now(),
      });
      router.replace("/prescriptions");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-[var(--tide-2)]/40">
      <CardContent className="space-y-3 p-4">
        <div className="eyebrow">{L("New prescription", "新增处方")}</div>
        <Field label={L("Name", "药名")}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={L("e.g. Ondansetron", "例如 昂丹司琼")}
            autoFocus
          />
        </Field>
        <Field label={L("Dose", "剂量")}>
          <TextInput
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder={L("e.g. 8 mg oral, PRN", "例如 8 mg 口服，按需")}
          />
        </Field>
        <Field label={L("Notes", "备注")}>
          <TextInput
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <div className="flex gap-2">
          <Button onClick={() => void save()} disabled={saving || !name.trim()}>
            <Save className="h-3.5 w-3.5" />
            {saving ? L("Saving…", "保存中…") : L("Save", "保存")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.replace("/prescriptions")}
          >
            {L("Cancel", "取消")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PrescriptionRow({
  med,
  locale,
}: {
  med: Medication;
  locale: "en" | "zh";
}) {
  const catalogue = DRUGS_BY_ID[med.drug_id];
  const name =
    (locale === "zh" ? catalogue?.name.zh : catalogue?.name.en) ??
    med.display_name ??
    med.drug_id;
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  const [editing, setEditing] = useState(false);
  const [dose, setDose] = useState(med.dose ?? "");
  const [notes, setNotes] = useState(med.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!med.id) return;
    setSaving(true);
    try {
      await db.medications.update(med.id, {
        dose: dose.trim() || undefined,
        notes: notes.trim() || undefined,
        updated_at: now(),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!med.id) return;
    await db.medications.update(med.id, {
      active: false,
      stopped_on: now(),
      updated_at: now(),
    });
  }

  return (
    <li className="rounded-[var(--r-md)] border border-ink-100 bg-paper-2">
      <div className="flex items-start gap-3 p-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--tide-soft)] text-[var(--tide-2)]">
          <Pill className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <div className="text-[14px] font-semibold text-ink-900">{name}</div>
            <div className="mono text-[10.5px] uppercase tracking-[0.12em] text-ink-400">
              {med.category}
              {med.source === "user_added" ? " · self-added" : ""}
            </div>
          </div>
          {!editing ? (
            <div className="mt-0.5 text-[12.5px] text-ink-500">
              {med.dose || L("No dose recorded", "尚未记录剂量")}
              {med.schedule?.label?.[locale] &&
                ` · ${med.schedule.label[locale]}`}
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <Field label={L("Dose", "剂量")}>
                <TextInput
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder={L("e.g. 500 mg BD", "例如 500 mg BD")}
                />
              </Field>
              <Field label={L("Notes", "备注")}>
                <TextInput
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={L(
                    "Reason for dose change, etc.",
                    "剂量变更原因等",
                  )}
                />
              </Field>
            </div>
          )}
          {med.notes && !editing && (
            <div className="mt-1 text-[11.5px] text-ink-500">{med.notes}</div>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {!editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={L("Edit", "编辑")}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 text-ink-600 hover:border-ink-400"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void del()}
                aria-label={L("Stop prescription", "停用处方")}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:border-[var(--warn)] hover:text-[var(--warn)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                aria-label={L("Save", "保存")}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-900 text-paper hover:bg-ink-700 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDose(med.dose ?? "");
                  setNotes(med.notes ?? "");
                  setEditing(false);
                }}
                aria-label={L("Cancel", "取消")}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:text-ink-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
