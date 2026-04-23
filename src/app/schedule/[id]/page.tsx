"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, Textarea } from "~/components/ui/field";
import { AppointmentForm } from "~/components/schedule/appointment-form";
import { AttendanceControls } from "~/components/schedule/attendance-controls";
import { LinkedRecords } from "~/components/schedule/linked-records";
import { PrepPanel } from "~/components/schedule/prep-panel";
import { useLocale, useT } from "~/hooks/use-translate";
import { useState } from "react";
import type { Appointment, AppointmentLink } from "~/types/appointment";
import { logTagsForKind } from "~/lib/appointments/follow-up-tasks";
import { ArrowLeft, Link2, Trash2, Pencil, Users, Check, MessageSquarePlus } from "lucide-react";

export default function AppointmentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const t = useT();
  const locale = useLocale();

  const appt = useLiveQuery(
    () => (Number.isFinite(id) ? db.appointments.get(id) : undefined),
    [id],
  );
  const incoming = useLiveQuery<AppointmentLink[]>(
    () =>
      Number.isFinite(id)
        ? db.appointment_links.where("to_id").equals(id).toArray()
        : Promise.resolve([] as AppointmentLink[]),
    [id],
  );
  const outgoing = useLiveQuery<AppointmentLink[]>(
    () =>
      Number.isFinite(id)
        ? db.appointment_links.where("from_id").equals(id).toArray()
        : Promise.resolve([] as AppointmentLink[]),
    [id],
  );

  const [editing, setEditing] = useState(false);

  if (!Number.isFinite(id)) {
    return (
      <div className="mx-auto max-w-xl p-6 text-sm text-ink-500">
        {t("schedule.notFound")}
      </div>
    );
  }
  if (appt === undefined) return null;
  if (!appt) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Button variant="ghost" onClick={() => router.push("/schedule")}>
          <ArrowLeft className="h-4 w-4" />
          {t("schedule.back")}
        </Button>
        <p className="mt-4 text-sm text-ink-500">{t("schedule.notFound")}</p>
      </div>
    );
  }

  async function remove() {
    const confirmed = typeof window !== "undefined"
      ? window.confirm(t("schedule.confirmDelete"))
      : false;
    if (!confirmed) return;
    await db.appointments.delete(id);
    await db.appointment_links.where("from_id").equals(id).delete();
    await db.appointment_links.where("to_id").equals(id).delete();
    router.push("/schedule");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <div>
        <Link
          href="/schedule"
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("schedule.back")}
        </Link>
      </div>

      {editing ? (
        <>
          <PageHeader
            eyebrow={t("schedule.eyebrow")}
            title={t("schedule.edit")}
          />
          <AppointmentForm existing={appt} />
        </>
      ) : (
        <>
          <PageHeader
            eyebrow={t(`schedule.kind.${appt.kind}`)}
            title={appt.title}
          />

          <AttendeeChips appt={appt} locale={locale} t={t} />

          <AttendanceControls appt={appt} locale={locale} />

          <LinkedRecords appt={appt} />

          <PrepPanel appt={appt} />

          <FollowUpPrompt appt={appt} locale={locale} t={t} />

          <Card className="space-y-3 p-5 text-[13px]">
            <Row
              label={t("schedule.form.startsAt")}
              value={formatDateTime(appt.starts_at, locale, appt.all_day)}
            />
            {appt.ends_at && (
              <Row
                label={t("schedule.form.endsAt")}
                value={formatDateTime(appt.ends_at, locale, appt.all_day)}
              />
            )}
            {appt.location && (
              <Row
                label={t("schedule.form.location")}
                value={
                  appt.location_url ? (
                    <a
                      href={appt.location_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline"
                    >
                      {appt.location}
                    </a>
                  ) : (
                    appt.location
                  )
                }
              />
            )}
            {appt.doctor && (
              <Row label={t("schedule.form.doctor")} value={appt.doctor} />
            )}
            {appt.phone && (
              <Row
                label={t("schedule.form.phone")}
                value={
                  <a href={`tel:${appt.phone}`} className="underline">
                    {appt.phone}
                  </a>
                }
              />
            )}
            <Row
              label={t("schedule.form.status")}
              value={t(`schedule.status.${appt.status}`)}
            />
            {appt.notes && (
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-ink-400">
                  {t("schedule.form.notes")}
                </div>
                <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-700">
                  {appt.notes}
                </p>
              </div>
            )}
          </Card>

          {(incoming?.length || outgoing?.length) && (
            <Card className="space-y-2 p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                <Link2 className="h-3.5 w-3.5" />
                {t("schedule.links")}
              </div>
              {(outgoing ?? []).map((l) => (
                <LinkRow key={`out-${l.id}`} link={l} as="from" t={t} />
              ))}
              {(incoming ?? []).map((l) => (
                <LinkRow key={`in-${l.id}`} link={l} as="to" t={t} />
              ))}
            </Card>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="danger" onClick={remove} size="md">
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </Button>
            <Button onClick={() => setEditing(true)} size="lg">
              <Pencil className="h-4 w-4" />
              {t("common.edit")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="mono text-[11px] uppercase tracking-[0.12em] text-ink-400">
        {label}
      </span>
      <span className="text-right text-ink-900">{value}</span>
    </div>
  );
}

function LinkRow({
  link,
  as,
  t,
}: {
  link: AppointmentLink;
  as: "from" | "to";
  t: (k: string) => string;
}) {
  const otherId = as === "from" ? link.to_id : link.from_id;
  const other = useLiveQuery(
    () => db.appointments.get(otherId),
    [otherId],
  ) as Appointment | undefined;
  if (!other) return null;
  const relationKey =
    link.relation === "prep_for"
      ? as === "from"
        ? "schedule.linkPrepForOutgoing"
        : "schedule.linkPrepForIncoming"
      : "schedule.linkFollowUp";
  return (
    <Link
      href={`/schedule/${otherId}`}
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[12.5px] hover:bg-paper-2"
    >
      <span className="text-ink-500">{t(relationKey)}</span>
      <span className="truncate font-medium text-ink-900">{other.title}</span>
    </Link>
  );
}

function formatDateTime(
  iso: string,
  locale: "en" | "zh",
  allDay?: boolean,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === "zh" ? "zh-CN" : "en-AU", {
    dateStyle: "medium",
    ...(allDay ? {} : { timeStyle: "short" }),
  });
}

// Small chip row showing the attending doctor + any listed attendees.
// Kept visually light — it's meta, not structure.
function AttendeeChips({
  appt,
  locale,
  t,
}: {
  appt: Appointment;
  locale: "en" | "zh";
  t: (k: string) => string;
}) {
  const all: { label: string; kind: "doctor" | "attendee" }[] = [];
  if (appt.doctor) all.push({ label: appt.doctor, kind: "doctor" });
  for (const name of appt.attendees ?? []) {
    if (!name?.trim()) continue;
    all.push({ label: name.trim(), kind: "attendee" });
  }
  if (all.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mono mr-1 text-[10px] uppercase tracking-[0.12em] text-ink-400">
        <Users className="mr-1 inline h-3 w-3" />
        {t("schedule.careTeam")}
      </span>
      {all.map((c, i) => (
        <span
          key={`${c.label}-${i}`}
          className={
            c.kind === "doctor"
              ? "inline-flex items-center rounded-full bg-[var(--tide-soft)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--tide-2)]"
              : "inline-flex items-center rounded-full border border-ink-200 bg-paper-2 px-2 py-0.5 text-[11.5px] text-ink-700"
          }
        >
          {c.label}
          {c.kind === "doctor" && (
            <span className="ml-1 text-[9px] uppercase tracking-wide opacity-70">
              {locale === "zh" ? "主诊" : "Lead"}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

// Prompt the patient to log what happened after a past appointment.
// Only shown when the appointment is past, not cancelled, and has no
// followup_logged_at yet. Submitting writes a `log_events` row tagged
// by kind (so the agent layer picks it up) and sets
// `followup_logged_at`, which dismisses the prompt.
function FollowUpPrompt({
  appt,
  locale,
  t,
}: {
  appt: Appointment;
  locale: "en" | "zh";
  t: (k: string) => string;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const startTime = new Date(appt.starts_at).getTime();
  const isPast = Number.isFinite(startTime) && startTime <= Date.now();
  const dismissed =
    appt.status === "cancelled" ||
    appt.status === "rescheduled" ||
    Boolean(appt.followup_logged_at);

  if (!isPast || dismissed || typeof appt.id !== "number") return null;

  async function submit() {
    if (!appt.id) return;
    setSaving(true);
    try {
      const nowIso = now();
      const body = text.trim();
      if (body) {
        const { getCachedUserId } = await import(
          "~/lib/supabase/current-user"
        );
        const uid = getCachedUserId();
        await db.log_events.add({
          at: nowIso,
          input: {
            text: `[follow-up · ${appt.kind}] ${appt.title}\n\n${body}`,
            tags: logTagsForKind(appt.kind),
            locale,
            at: nowIso,
            entered_by_user_id: uid ?? undefined,
          },
        });
      }
      await db.appointments.update(appt.id, {
        followup_logged_at: nowIso,
        status: "attended",
        updated_at: nowIso,
      });
      setText("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-3 border-[var(--tide-2)]/40 bg-[var(--tide-soft)]/30 p-4">
      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-900">
        <MessageSquarePlus className="h-3.5 w-3.5 text-[var(--tide-2)]" />
        {t(`schedule.followUp.prompt.${appt.kind}`)}
      </div>
      <Field label={t("schedule.followUp.label")}>
        <Textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(`schedule.followUp.placeholder.${appt.kind}`)}
          disabled={saving}
        />
      </Field>
      <div className="flex items-center justify-end gap-2">
        <Button onClick={submit} disabled={saving} size="md">
          <Check className="h-4 w-4" />
          {saving
            ? t("schedule.followUp.saving")
            : t("schedule.followUp.save")}
        </Button>
      </div>
    </Card>
  );
}
