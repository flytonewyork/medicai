"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, Textarea } from "~/components/ui/field";
import { useLocale, useT } from "~/hooks/use-translate";
import { AppointmentForm } from "~/components/schedule/appointment-form";
import type { ParsedAppointment } from "~/lib/appointments/schema";
import type { Appointment } from "~/types/appointment";
import { Loader2, ImagePlus, Mail, FilePen } from "lucide-react";

function NewAppointmentInner() {
  const t = useT();
  const locale = useLocale();
  const params = useSearchParams();
  const via = params.get("via") ?? "manual";
  const prefillDate = params.get("date");

  const [parsed, setParsed] = useState<Partial<Appointment> | null>(null);

  const initial: Partial<Appointment> | undefined = parsed
    ? parsed
    : prefillDate
      ? {
          starts_at: new Date(`${prefillDate}T09:00:00`).toISOString(),
          all_day: false,
        }
      : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={t("schedule.eyebrow")}
        title={
          via === "photo"
            ? t("schedule.new.fromPhoto")
            : via === "email"
              ? t("schedule.new.fromEmail")
              : t("schedule.new.manual")
        }
      />

      {via === "photo" && !parsed && (
        <PhotoIngest onParsed={setParsed} locale={locale} t={t} />
      )}
      {via === "email" && !parsed && (
        <EmailIngest onParsed={setParsed} locale={locale} t={t} />
      )}

      {(via === "manual" || parsed) && (
        <>
          {parsed && (
            <Card className="p-3 text-[12.5px] text-ink-700">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <FilePen className="h-3.5 w-3.5" />
                {t("schedule.new.parsed")}
              </div>
              <div className="text-ink-500">{t("schedule.new.parsedHint")}</div>
            </Card>
          )}
          <AppointmentForm initial={initial} />
        </>
      )}
    </div>
  );
}

function PhotoIngest({
  onParsed,
  locale,
  t,
}: {
  onParsed: (a: Partial<Appointment>) => void;
  locale: "en" | "zh";
  t: (k: string) => string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const mediaType = (file.type || "image/jpeg") as
        | "image/jpeg"
        | "image/png"
        | "image/gif"
        | "image/webp";
      const res = await fetch("/api/parse-appointment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageBase64: dataUrl,
          imageMediaType: mediaType,
          locale,
          today: new Date().toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { appointment: ParsedAppointment };
      onParsed(toAppointmentShape(data.appointment));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-ink-300 bg-paper-2 p-8 text-center hover:border-ink-500">
        <ImagePlus className="h-6 w-6 text-ink-500" />
        <span className="text-sm font-semibold text-ink-900">
          {t("schedule.new.photoCta")}
        </span>
        <span className="text-[12px] text-ink-500">
          {t("schedule.new.photoHint")}
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
      </label>
      {busy && (
        <div
          role="status"
          className="flex items-center gap-2 text-[13px] text-ink-700"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("schedule.new.parsing")}
        </div>
      )}
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

function EmailIngest({
  onParsed,
  locale,
  t,
}: {
  onParsed: (a: Partial<Appointment>) => void;
  locale: "en" | "zh";
  t: (k: string) => string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/parse-appointment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          locale,
          today: new Date().toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { appointment: ParsedAppointment };
      onParsed(toAppointmentShape(data.appointment));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-900">
        <Mail className="h-3.5 w-3.5" />
        {t("schedule.new.emailCta")}
      </div>
      <Field label={t("schedule.new.emailLabel")}>
        <Textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("schedule.new.emailPlaceholder")}
          disabled={busy}
        />
      </Field>
      {busy && (
        <div className="flex items-center gap-2 text-[13px] text-ink-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("schedule.new.parsing")}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-2.5 text-[12.5px] text-[var(--warn)]"
        >
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={submit} disabled={busy || !text.trim()} size="lg">
          {t("schedule.new.parseCta")}
        </Button>
      </div>
    </Card>
  );
}

function toAppointmentShape(p: ParsedAppointment): Partial<Appointment> {
  return {
    kind: p.kind,
    title: p.title,
    starts_at: p.starts_at,
    ends_at: p.ends_at,
    all_day: p.all_day,
    location: p.location,
    doctor: p.doctor,
    phone: p.phone,
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
