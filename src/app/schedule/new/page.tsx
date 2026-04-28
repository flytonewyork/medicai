"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db, now } from "~/lib/db/dexie";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, Textarea } from "~/components/ui/field";
import { useLocale, useT } from "~/hooks/use-translate";
import { AppointmentForm } from "~/components/schedule/appointment-form";
import type { ParsedAppointment } from "~/lib/appointments/schema";
import type { Appointment } from "~/types/appointment";
import { Loader2, ImagePlus, Sparkles } from "lucide-react";
import { todayISO } from "~/lib/utils/date";
import { postJson } from "~/lib/utils/http";

// One unified "smart entry" surface. The patient can:
//   1. Paste an email body or free-text ("Chemo Friday 10am with Dr Lee at Epworth")
//   2. Snap a photo of an appointment card / letter / screenshot
//   3. Ignore the smart box and fill the form manually
// Parse + photo routes auto-save the appointment and bounce straight to the
// detail page with ?added=parse so the user sees a "successfully added" state
// with the populated fields they can review or correct. The parse is best-
// effort; missing mandatory fields (title/starts_at) fall back to prefilling
// the form instead of saving.
function NewAppointmentInner() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const prefillDate = params.get("date");
  const prefillTime = params.get("time") ?? "09:00";
  const prefillKind = params.get("kind") as Appointment["kind"] | null;
  const prefillTitle = params.get("title");
  const prefillCycleId = params.get("cycle");

  const [prefillFromParse, setPrefillFromParse] =
    useState<Partial<Appointment> | null>(null);

  const initial: Partial<Appointment> | undefined = prefillFromParse
    ? prefillFromParse
    : prefillDate || prefillKind || prefillTitle || prefillCycleId
      ? {
          starts_at: prefillDate
            ? new Date(`${prefillDate}T${prefillTime}:00`).toISOString()
            : undefined,
          all_day: false,
          kind: prefillKind ?? undefined,
          title: prefillTitle ?? undefined,
          cycle_id: prefillCycleId ? Number(prefillCycleId) : undefined,
          derived_from_cycle: prefillCycleId ? true : undefined,
        }
      : undefined;

  async function handleParsed(p: ParsedAppointment) {
    const shape = toAppointmentShape(p);
    // Auto-save when the parse is usable — must have a title and a valid
    // start timestamp. Anything less-formed falls back to prefilling the
    // form so the user can complete it by hand.
    const startsIso = typeof shape.starts_at === "string" ? shape.starts_at : "";
    const titleTrim = (shape.title ?? "").trim();
    const parsable =
      titleTrim.length > 0 &&
      startsIso.length > 0 &&
      !Number.isNaN(Date.parse(startsIso));
    if (!parsable) {
      setPrefillFromParse(shape);
      return;
    }
    try {
      const ts = now();
      const record: Appointment = {
        kind: shape.kind ?? "other",
        title: titleTrim,
        starts_at: new Date(startsIso).toISOString(),
        ends_at: shape.ends_at,
        all_day: shape.all_day,
        location: shape.location,
        doctor: shape.doctor,
        phone: shape.phone,
        notes: shape.notes,
        status: "scheduled",
        prep: shape.prep,
        prep_info_received: shape.prep_info_received,
        created_at: ts,
        updated_at: ts,
      };
      const id = (await db.appointments.add(record)) as number;
      router.push(`/schedule/${id}?added=parse`);
    } catch {
      // Fall back to prefill if the write fails — the form save path will
      // surface the real error on retry.
      setPrefillFromParse(shape);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={t("schedule.eyebrow")}
        title={t("schedule.new.title")}
      />

      <SmartEntry onParsed={handleParsed} locale={locale} t={t} />

      <AppointmentForm
        initial={initial}
        key={prefillFromParse ? "parsed" : "blank"}
      />
    </div>
  );
}

function SmartEntry({
  onParsed,
  locale,
  t,
}: {
  onParsed: (a: ParsedAppointment) => void | Promise<void>;
  locale: "en" | "zh";
  t: (k: string) => string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function parseText() {
    if (!text.trim()) return;
    await callParser({ text, locale });
  }

  async function onPhoto(file: File) {
    const dataUrl = await fileToDataUrl(file);
    const mediaType = (file.type || "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";
    await callParser({ imageBase64: dataUrl, imageMediaType: mediaType, locale });
  }

  async function callParser(body: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      const data = await postJson<{ appointment: ParsedAppointment }>(
        "/api/parse-appointment",
        { ...body, today: todayISO() },
      );
      await onParsed(data.appointment);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-900">
        <Sparkles className="h-3.5 w-3.5 text-[var(--tide-2)]" />
        {t("schedule.new.smartTitle")}
      </div>
      <p className="text-[12px] text-ink-500">
        {t("schedule.new.smartHint")}
      </p>

      <Field label={t("schedule.new.smartLabel")}>
        <Textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("schedule.new.smartPlaceholder")}
          disabled={busy}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={parseText} disabled={busy || !text.trim()}>
          {t("schedule.new.parseCta")}
        </Button>
        <label
          className={
            "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-ink-200 px-3 py-2 text-[13px] text-ink-700 hover:bg-ink-100/40 " +
            (busy ? "pointer-events-none opacity-50" : "")
          }
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {t("schedule.new.photoCta")}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPhoto(f);
            }}
          />
        </label>
        {busy && (
          <div
            role="status"
            className="flex items-center gap-1.5 text-[12.5px] text-ink-600"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("schedule.new.parsing")}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-2.5 text-[12.5px] text-[var(--warn)]"
        >
          {error}
        </div>
      )}
    </Card>
  );
}

function toAppointmentShape(p: ParsedAppointment): Partial<Appointment> {
  const prep = (p.prep ?? []).map((x) => ({
    kind: x.kind,
    description: x.description,
    starts_at: x.starts_at,
    hours_before: x.hours_before,
    info_source: "email" as const,
  }));
  return {
    kind: p.kind,
    title: p.title,
    starts_at: p.starts_at,
    ends_at: p.ends_at,
    all_day: p.all_day,
    location: p.location,
    doctor: p.doctor,
    phone: p.phone,
    prep,
    // If the parser pulled any prep out of the source, the source itself is
    // the received info — flip the "still waiting for prep details" flag off.
    prep_info_received: prep.length > 0 ? true : undefined,
    notes:
      p.ambiguities && p.ambiguities.length > 0
        ? [
            p.notes ?? "",
            "",
            "Parser ambiguities:",
            ...p.ambiguities.map((a) => `- ${a}`),
          ]
            .filter(Boolean)
            .join("\n")
        : p.notes,
    status: "scheduled",
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function NewAppointmentPage() {
  return (
    <Suspense fallback={null}>
      <NewAppointmentInner />
    </Suspense>
  );
}
