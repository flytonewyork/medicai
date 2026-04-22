"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db, now } from "~/lib/db/dexie";
import { appointmentInputSchema } from "~/lib/appointments/schema";
import type {
  Appointment,
  AppointmentKind,
  AppointmentStatus,
} from "~/types/appointment";
import { useLocale, useT } from "~/hooks/use-translate";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Field, TextInput, Textarea } from "~/components/ui/field";

const KINDS: AppointmentKind[] = [
  "clinic",
  "chemo",
  "scan",
  "blood_test",
  "procedure",
  "other",
];

interface PrefillLink {
  to_id: number;
  relation: "prep_for";
  offset_days: number;
}

export function AppointmentForm({
  existing,
  initial,
  linkOnSave,
}: {
  existing?: Appointment;
  // Partial shape handed in from the photo/email parser to prefill the form
  initial?: Partial<Appointment>;
  // When present, a prep-link is written from the newly-created
  // appointment to the given to_id after save.
  linkOnSave?: PrefillLink;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const [form, setForm] = useState<Partial<Appointment>>(() => ({
    kind: existing?.kind ?? initial?.kind ?? "clinic",
    title: existing?.title ?? initial?.title ?? "",
    starts_at: existing?.starts_at ?? initial?.starts_at ?? "",
    ends_at: existing?.ends_at ?? initial?.ends_at ?? "",
    all_day: existing?.all_day ?? initial?.all_day ?? false,
    location: existing?.location ?? initial?.location ?? "",
    doctor: existing?.doctor ?? initial?.doctor ?? "",
    phone: existing?.phone ?? initial?.phone ?? "",
    notes: existing?.notes ?? initial?.notes ?? "",
    status: existing?.status ?? "scheduled",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Live-update when an ingest parse flows in after mount
    if (initial && !existing) {
      setForm((f) => ({ ...f, ...initial }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.starts_at, initial?.title, initial?.kind, initial?.location]);

  const startLocal = useMemo(() => toLocalInput(form.starts_at), [form.starts_at]);
  const endLocal = useMemo(() => toLocalInput(form.ends_at), [form.ends_at]);

  function update<K extends keyof Appointment>(
    k: K,
    v: Appointment[K] | undefined,
  ) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setError(null);
    const parsed = appointmentInputSchema.safeParse({
      ...form,
      starts_at:
        form.starts_at && !form.starts_at.includes("T")
          ? new Date(form.starts_at).toISOString()
          : form.starts_at,
      ends_at: form.ends_at || undefined,
      location_url: undefined,
      attendees: form.attendees,
      attachments: form.attachments,
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
      );
      return;
    }

    setSaving(true);
    try {
      const ts = now();
      const record: Appointment = {
        ...parsed.data,
        status: parsed.data.status ?? "scheduled",
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };

      let id: number;
      if (existing?.id) {
        // Dexie's UpdateSpec is stricter than the row shape; cast once at
        // the boundary where we know the shape matches.
        await db.appointments.update(
          existing.id,
          record as unknown as Partial<Appointment>,
        );
        id = existing.id;
      } else {
        id = (await db.appointments.add(record)) as number;
      }

      if (linkOnSave && !existing?.id) {
        await db.appointment_links.add({
          from_id: id,
          to_id: linkOnSave.to_id,
          relation: linkOnSave.relation,
          offset_days: linkOnSave.offset_days,
          created_at: ts,
        });
      }

      router.push(`/schedule/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <Field label={t("schedule.form.kind")}>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => update("kind", k)}
              className={
                "h-9 rounded-full border px-3 text-xs font-medium " +
                (form.kind === k
                  ? "border-ink-900 bg-ink-900 text-paper"
                  : "border-ink-200 bg-paper-2 text-ink-500 hover:border-ink-400")
              }
            >
              {t(`schedule.kind.${k}`)}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t("schedule.form.title")}>
        <TextInput
          value={form.title ?? ""}
          onChange={(e) => update("title", e.target.value)}
          placeholder={
            locale === "zh" ? "例：李医生复诊" : "e.g. Cycle 3 consult with Dr Lee"
          }
          required
        />
      </Field>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("schedule.form.startsAt")}>
          <TextInput
            type="datetime-local"
            value={startLocal}
            onChange={(e) =>
              update(
                "starts_at",
                e.target.value
                  ? new Date(e.target.value).toISOString()
                  : undefined,
              )
            }
            required
          />
        </Field>
        <Field label={t("schedule.form.endsAt")}>
          <TextInput
            type="datetime-local"
            value={endLocal}
            onChange={(e) =>
              update(
                "ends_at",
                e.target.value
                  ? new Date(e.target.value).toISOString()
                  : undefined,
              )
            }
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-[12.5px] text-ink-700">
        <input
          type="checkbox"
          checked={!!form.all_day}
          onChange={(e) => update("all_day", e.target.checked)}
        />
        {t("schedule.form.allDay")}
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("schedule.form.location")}>
          <TextInput
            value={form.location ?? ""}
            onChange={(e) => update("location", e.target.value)}
            placeholder={
              locale === "zh" ? "例：Epworth Richmond 四楼" : "Epworth Richmond L4"
            }
          />
        </Field>
        <Field label={t("schedule.form.doctor")}>
          <TextInput
            value={form.doctor ?? ""}
            onChange={(e) => update("doctor", e.target.value)}
            placeholder={locale === "zh" ? "例：李医生" : "Dr Michael Lee"}
          />
        </Field>
      </div>

      <Field label={t("schedule.form.phone")}>
        <TextInput
          value={form.phone ?? ""}
          onChange={(e) => update("phone", e.target.value)}
        />
      </Field>

      <Field label={t("schedule.form.notes")}>
        <Textarea
          value={form.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
          rows={4}
          placeholder={
            locale === "zh"
              ? "带什么、准备什么、家人陪同……"
              : "What to bring, prep, who's coming..."
          }
        />
      </Field>

      <Field label={t("schedule.form.status")}>
        <div className="flex gap-2">
          {(["scheduled", "attended", "missed", "cancelled"] as AppointmentStatus[]).map(
            (s) => (
              <button
                key={s}
                type="button"
                onClick={() => update("status", s)}
                className={
                  "h-8 rounded-md border px-3 text-[11.5px] " +
                  (form.status === s
                    ? "border-ink-900 bg-ink-900 text-paper"
                    : "border-ink-200 bg-paper-2 text-ink-500")
                }
              >
                {t(`schedule.status.${s}`)}
              </button>
            ),
          )}
        </div>
      </Field>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-2.5 text-[12.5px] text-[var(--warn)]"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          disabled={saving}
        >
          {t("common.cancel")}
        </Button>
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </Card>
  );
}

function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
