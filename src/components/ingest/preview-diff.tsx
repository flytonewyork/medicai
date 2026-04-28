"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { applyIngestOps } from "~/lib/ingest/operations";
import type {
  IngestApplyResult,
  IngestDraft,
  IngestOp,
  IngestOpKind,
} from "~/types/ingest";
import { useLocale, useL } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { TextInput, Textarea } from "~/components/ui/field";
import {
  CalendarPlus,
  CalendarClock,
  TestTube2,
  Pill,
  Users,
  ListChecks,
  BookOpenText,
  Check,
  X,
  Sparkles,
  AlertTriangle,
  ScanLine,
  Dna,
  Syringe,
  Gavel,
  Settings as SettingsIcon,
  PencilLine,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";
import type { LocalizedText } from "~/types/localized";

const OP_ICON: Record<IngestOpKind, React.ComponentType<{ className?: string }>> = {
  add_appointment: CalendarPlus,
  update_appointment: CalendarClock,
  add_lab_result: TestTube2,
  update_lab_result: PencilLine,
  add_imaging: ScanLine,
  add_ctdna_result: Dna,
  add_medication: Pill,
  update_medication: PencilLine,
  add_care_team_member: Users,
  add_task: ListChecks,
  add_life_event: BookOpenText,
  add_treatment_cycle: Syringe,
  add_decision: Gavel,
  update_settings: SettingsIcon,
};

const OP_LABEL: Record<IngestOpKind, LocalizedText> = {
  add_appointment: { en: "New appointment", zh: "新增预约" },
  update_appointment: { en: "Update appointment", zh: "更新预约" },
  add_lab_result: { en: "New lab result", zh: "新增化验结果" },
  update_lab_result: { en: "Update lab result", zh: "更新化验结果" },
  add_imaging: { en: "New imaging report", zh: "新增影像报告" },
  add_ctdna_result: { en: "New ctDNA result", zh: "新增 ctDNA 结果" },
  add_medication: { en: "New medication", zh: "新增用药" },
  update_medication: { en: "Update medication", zh: "更新用药" },
  add_care_team_member: { en: "New care-team contact", zh: "新增团队联系人" },
  add_task: { en: "New task", zh: "新增任务" },
  add_life_event: { en: "Note this event", zh: "记录事件" },
  add_treatment_cycle: { en: "Start new treatment cycle", zh: "开始新疗程" },
  add_decision: { en: "Record decision", zh: "记录决定" },
  update_settings: { en: "Update clinical contacts", zh: "更新医疗团队联系方式" },
};

interface Props {
  draft: IngestDraft;
  onApplied: (results: IngestApplyResult[]) => void;
  onDiscard: () => void;
}

export function PreviewDiff({ draft, onApplied, onDiscard }: Props) {
  const locale = useLocale();
  const L = useL();

  // Per-op include toggle. Defaults: every op selected, except low-
  // confidence drafts where we let the user opt in deliberately.
  const initialSelected = useMemo(() => {
    const set = new Set<number>();
    if (draft.confidence !== "low") {
      draft.ops.forEach((_, i) => set.add(i));
    }
    return set;
  }, [draft]);
  const [selected, setSelected] = useState<Set<number>>(initialSelected);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<IngestApplyResult[] | null>(null);
  // Per-op field overrides. Keyed by index. We keep the full (possibly
  // edited) op here so multi-field edits roll up into one object the
  // save path can use directly.
  const [edits, setEdits] = useState<Record<number, IngestOp>>({});
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function patch(i: number, next: IngestOp) {
    setEdits((prev) => ({ ...prev, [i]: next }));
  }

  function effectiveOp(i: number): IngestOp {
    return edits[i] ?? draft.ops[i]!;
  }

  async function applySelected() {
    const ops = draft.ops
      .map((_, i) => (selected.has(i) ? effectiveOp(i) : null))
      .filter((o): o is IngestOp => o !== null);
    if (ops.length === 0) return;
    setApplying(true);
    try {
      const r = await applyIngestOps(ops, {
        provenance: {
          source_system: draft.source_system,
          source_pdf_id: draft.source_pdf_id,
        },
      });
      setResults(r);
      onApplied(r);
    } finally {
      setApplying(false);
    }
  }

  // Auto-close on a fully-successful save. Users kept staring at the
  // preview wondering whether anything happened; closing returns them
  // to the ingest landing which is where the next capture starts.
  useEffect(() => {
    if (!results) return;
    const allOk = results.length > 0 && results.every((r) => r.ok);
    if (!allOk) return;
    const t = setTimeout(() => onDiscard(), 1400);
    return () => clearTimeout(t);
  }, [results, onDiscard]);

  const savedAppointmentIds = useMemo(() => {
    if (!results) return [] as number[];
    return results
      .filter(
        (r) =>
          r.ok &&
          typeof r.id === "number" &&
          (r.op.kind === "add_appointment" ||
            r.op.kind === "update_appointment"),
      )
      .map((r) => r.id as number);
  }, [results]);

  const okCount = results?.filter((r) => r.ok).length ?? 0;
  const failCount = (results?.length ?? 0) - okCount;

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tide-2)]" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13.5px] font-semibold text-ink-900">
                {L(
                  "Proposed changes",
                  "建议的变更",
                )}
              </span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]",
                  draft.confidence === "high"
                    ? "bg-[var(--ok-soft)] text-[var(--ok)]"
                    : draft.confidence === "medium"
                      ? "bg-ink-100 text-ink-700"
                      : "bg-[var(--warn-soft)] text-[var(--warn)]",
                )}
              >
                {draft.confidence}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-ink-500">{draft.summary}</p>
          </div>
        </div>

        {draft.ambiguities.length > 0 && (
          <div className="rounded-md border border-[var(--sand-2)]/40 bg-[var(--sand)]/40 p-2.5 text-[11.5px] text-ink-700">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3 w-3" />
              {L("Things I guessed", "我做了这些假设")}
            </div>
            <ul className="list-disc space-y-0.5 pl-4">
              {draft.ambiguities.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        <ul className="space-y-2">
          {draft.ops.map((op, i) => (
            <li key={i}>
              <OpCard
                op={effectiveOp(i)}
                index={i}
                selected={selected.has(i)}
                editing={editingIdx === i}
                result={results?.[results.findIndex((r) => r.op === op)] ?? null}
                onToggle={() => toggle(i)}
                onEdit={() =>
                  setEditingIdx((prev) => (prev === i ? null : i))
                }
                onChange={(next) => patch(i, next)}
                locale={locale}
              />
            </li>
          ))}
        </ul>

        {results ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink-200 bg-paper-2 p-3 text-[13px]">
            <div>
              <span className="font-semibold text-[var(--ok)]">
                {L(
                  `${okCount} saved`,
                  `已保存 ${okCount}`,
                )}
              </span>
              {failCount > 0 && (
                <span className="ml-2 text-[var(--warn)]">
                  {failCount} {L("failed", "失败")}
                </span>
              )}
              {failCount === 0 && (
                <span className="ml-2 text-[11px] text-ink-500">
                  {L("closing…", "即将关闭…")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {savedAppointmentIds.length > 0 && (
                <Link
                  href="/schedule"
                  className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2.5 py-1 text-[12px] text-ink-700 hover:border-[var(--tide-2)] hover:text-[var(--tide-2)]"
                >
                  {L("View in Schedule", "前往日程")}
                </Link>
              )}
              <Button onClick={onDiscard} variant="ghost">
                {L("Done", "完成")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={onDiscard}>
              <X className="h-4 w-4" />
              {L("Discard", "放弃")}
            </Button>
            <Button
              onClick={applySelected}
              disabled={applying || selected.size === 0}
              size="lg"
            >
              <Check className="h-4 w-4" />
              {applying
                ? L("Saving…", "保存中…")
                : L(
                    `Save ${selected.size} item${selected.size === 1 ? "" : "s"}`,
                    `保存 ${selected.size} 项`,
                  )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const EDITABLE_KINDS: IngestOpKind[] = [
  "add_appointment",
  "add_task",
  "add_medication",
];

function OpCard({
  op,
  index,
  selected,
  editing,
  result,
  onToggle,
  onEdit,
  onChange,
  locale,
}: {
  op: IngestOp;
  index: number;
  selected: boolean;
  editing: boolean;
  result: IngestApplyResult | null;
  onToggle: () => void;
  onEdit: () => void;
  onChange: (next: IngestOp) => void;
  locale: "en" | "zh";
}) {
  const Icon = OP_ICON[op.kind];
  const label = OP_LABEL[op.kind][locale];
  const lines = describeOp(op, locale);
  const reason = "reason" in op && op.reason ? op.reason : null;
  const canEdit = EDITABLE_KINDS.includes(op.kind) && !result;

  return (
    <div
      className={cn(
        "rounded-[var(--r-md)] border p-3",
        result?.ok
          ? "border-[var(--ok)]/40 bg-[var(--ok-soft)]/40"
          : result && !result.ok
            ? "border-[var(--warn)]/40 bg-[var(--warn-soft)]/40"
            : selected
              ? "border-ink-900 bg-ink-900/[0.03]"
              : "border-ink-100 bg-paper-2",
      )}
    >
      <div className="flex items-start gap-3">
        <label className="mt-1 flex shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            disabled={Boolean(result)}
            className="h-4 w-4 accent-ink-900"
          />
        </label>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-paper-2 text-[var(--tide-2)]">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-[12.5px] font-semibold text-ink-900">
                {label}
              </span>
              <span className="mono text-[10px] text-ink-400">
                #{index + 1}
              </span>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-0.5 text-[11px] text-ink-700 hover:border-[var(--tide-2)] hover:text-[var(--tide-2)]"
              >
                <PencilLine className="h-3 w-3" />
                {editing
                  ? locale === "zh"
                    ? "收起"
                    : "Done"
                  : locale === "zh"
                    ? "编辑"
                    : "Edit"}
              </button>
            )}
          </div>
          {reason && (
            <p className="mt-0.5 text-[11.5px] italic text-ink-500">
              {reason}
            </p>
          )}
          {editing && canEdit ? (
            <OpEditor op={op} onChange={onChange} locale={locale} />
          ) : (
            lines.length > 0 && (
              <dl className="mt-1.5 space-y-0.5 text-[12px]">
                {lines.map(([k, v]) => (
                  <div key={k} className="flex gap-1.5">
                    <dt className="mono text-[10.5px] uppercase tracking-[0.08em] text-ink-400">
                      {k}
                    </dt>
                    <dd className="text-ink-800">{v}</dd>
                  </div>
                ))}
              </dl>
            )
          )}
          {result && !result.ok && (
            <p className="mt-1.5 text-[11px] text-[var(--warn)]">
              {result.error}
            </p>
          )}
          {result?.ok && (
            <p className="mt-1.5 text-[11px] text-[var(--ok)]">
              {locale === "zh" ? `已保存 #${result.id}` : `Saved as #${result.id}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact editor shown in the preview card. Only the most commonly
// incorrect fields are surfaced — title, date/time, location, doctor
// for appointments; title + due_date for tasks; name + dose + schedule
// for medications. The full detail form still lives on the detail page
// post-save; this is just to stop the user having to delete+recreate a
// row for a single typo.
function OpEditor({
  op,
  onChange,
  locale,
}: {
  op: IngestOp;
  onChange: (next: IngestOp) => void;
  locale: "en" | "zh";
}) {
  const L = useL();

  if (op.kind === "add_appointment") {
    const data = op.data as Record<string, unknown>;
    const set = (k: string, v: unknown) =>
      onChange({ ...op, data: { ...data, [k]: v } });
    return (
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <FieldRow label={L("Title", "标题")} full>
          <TextInput
            value={(data.title as string) ?? ""}
            onChange={(e) => set("title", e.target.value)}
          />
        </FieldRow>
        <FieldRow label={L("Starts", "开始时间")}>
          <TextInput
            type="datetime-local"
            value={toDatetimeLocal(data.starts_at as string | undefined)}
            onChange={(e) =>
              set("starts_at", fromDatetimeLocal(e.target.value))
            }
          />
        </FieldRow>
        <FieldRow label={L("Ends", "结束时间")}>
          <TextInput
            type="datetime-local"
            value={toDatetimeLocal(data.ends_at as string | undefined)}
            onChange={(e) =>
              set("ends_at", fromDatetimeLocal(e.target.value))
            }
          />
        </FieldRow>
        <FieldRow label={L("Location", "地点")} full>
          <TextInput
            value={(data.location as string) ?? ""}
            onChange={(e) => set("location", e.target.value)}
          />
        </FieldRow>
        <FieldRow label={L("Doctor", "医师")}>
          <TextInput
            value={(data.doctor as string) ?? ""}
            onChange={(e) => set("doctor", e.target.value)}
          />
        </FieldRow>
        <FieldRow label={L("Phone", "电话")}>
          <TextInput
            value={(data.phone as string) ?? ""}
            onChange={(e) => set("phone", e.target.value)}
          />
        </FieldRow>
        <FieldRow label={L("Notes", "备注")} full>
          <Textarea
            rows={2}
            value={(data.notes as string) ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </FieldRow>
      </div>
    );
  }

  if (op.kind === "add_task") {
    const data = op.data as Record<string, unknown>;
    const set = (k: string, v: unknown) =>
      onChange({ ...op, data: { ...data, [k]: v } });
    return (
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <FieldRow label={L("Title", "标题")} full>
          <TextInput
            value={(data.title as string) ?? ""}
            onChange={(e) => set("title", e.target.value)}
          />
        </FieldRow>
        <FieldRow label={L("Due date", "到期日")}>
          <TextInput
            type="date"
            value={(data.due_date as string) ?? ""}
            onChange={(e) => set("due_date", e.target.value)}
          />
        </FieldRow>
        <FieldRow label={L("Category", "分类")}>
          <TextInput
            value={(data.category as string) ?? ""}
            onChange={(e) => set("category", e.target.value)}
          />
        </FieldRow>
        <FieldRow label={L("Notes", "备注")} full>
          <Textarea
            rows={2}
            value={(data.notes as string) ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </FieldRow>
      </div>
    );
  }

  if (op.kind === "add_medication") {
    const data = op.data as Record<string, unknown>;
    const set = (k: string, v: unknown) =>
      onChange({ ...op, data: { ...data, [k]: v } });
    return (
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <FieldRow label={L("Drug", "药物")} full>
          <TextInput
            value={
              ((data.display_name as string) ??
                (data.drug_id as string) ??
                "") as string
            }
            onChange={(e) => set("display_name", e.target.value)}
          />
        </FieldRow>
        <FieldRow label={L("Dose", "剂量")}>
          <TextInput
            value={(data.dose as string) ?? ""}
            onChange={(e) => set("dose", e.target.value)}
          />
        </FieldRow>
        <FieldRow label={L("Started on", "开始日期")}>
          <TextInput
            type="date"
            value={(data.started_on as string) ?? ""}
            onChange={(e) => set("started_on", e.target.value)}
          />
        </FieldRow>
        <FieldRow label={L("Notes", "备注")} full>
          <Textarea
            rows={2}
            value={(data.notes as string) ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </FieldRow>
      </div>
    );
  }

  return null;
}

function FieldRow({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block space-y-1", full && "sm:col-span-2")}>
      <span className="mono text-[10px] uppercase tracking-[0.1em] text-ink-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function toDatetimeLocal(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function describeOp(op: IngestOp, locale: "en" | "zh"): Array<[string, string]> {
  const data = "data" in op ? op.data : "changes" in op ? op.changes : {};
  const out: Array<[string, string]> = [];
  function push(key: string, value: unknown) {
    if (value === null || value === undefined || value === "") return;
    if (Array.isArray(value)) value = value.join(", ");
    out.push([key, String(value)]);
  }

  // Order is curated for readability per op kind; everything else
  // gets dumped at the end so the user can audit.
  const showFirst: Record<string, string[]> = {
    add_appointment: ["title", "kind", "starts_at", "location", "doctor", "phone", "notes"],
    update_appointment: ["title", "starts_at", "location", "doctor", "status", "notes"],
    add_lab_result: ["date", "ca199", "albumin", "hemoglobin", "neutrophils", "platelets", "creatinine"],
    update_lab_result: ["date", "ca199", "albumin", "hemoglobin", "neutrophils", "platelets", "creatinine"],
    add_imaging: ["date", "modality", "findings_summary", "recist_status", "notes"],
    add_ctdna_result: ["date", "platform", "detected", "value", "unit"],
    add_medication: ["drug_id", "category", "dose", "schedule", "started_on", "notes"],
    update_medication: ["drug_id", "dose", "schedule", "active", "notes"],
    add_care_team_member: ["name", "role", "specialty", "organisation", "phone", "email"],
    add_task: ["title", "due_date", "priority", "category", "notes"],
    add_life_event: ["title", "event_date", "category", "notes"],
    add_treatment_cycle: ["protocol_id", "cycle_number", "start_date", "dose_level", "status"],
    add_decision: ["decision_date", "summary", "rationale", "made_by"],
    update_settings: ["managing_oncologist", "managing_oncologist_phone", "hospital_name", "hospital_phone", "oncall_phone"],
  };
  const order = showFirst[op.kind] ?? [];
  for (const k of order) push(k, (data as Record<string, unknown>)[k]);
  for (const [k, v] of Object.entries(data)) {
    if (order.includes(k)) continue;
    push(k, v);
  }

  // Match info for updates
  if (
    (op.kind === "update_appointment" ||
      op.kind === "update_medication" ||
      op.kind === "update_lab_result") &&
    "match" in op &&
    op.match
  ) {
    const m = op.match as Record<string, unknown>;
    if (typeof m.id === "number") push("matches id", m.id);
    if (typeof m.title_contains === "string")
      push(locale === "zh" ? "匹配标题" : "matches title", m.title_contains);
    if (typeof m.on_date === "string")
      push(locale === "zh" ? "于日期" : "on date", m.on_date);
    if (typeof m.drug_id === "string")
      push(locale === "zh" ? "药物" : "drug", m.drug_id);
    if (typeof m.name_contains === "string")
      push(locale === "zh" ? "名称包含" : "name contains", m.name_contains);
  }
  return out;
}
