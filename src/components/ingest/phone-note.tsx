"use client";

import { useState } from "react";
import { useLocale, useL } from "~/hooks/use-translate";
import { todayISO } from "~/lib/utils/date";
import { postJson } from "~/lib/utils/http";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, Textarea } from "~/components/ui/field";
import { Mic, MicOff, AlertCircle, Loader2, Phone } from "lucide-react";
import type { IngestDraft } from "~/types/ingest";
import { useVoiceTranscription } from "~/hooks/use-voice-transcription";

// Quick-capture surface for phone-call instructions. The patient (or
// the carer on the line) types or dictates what they just heard; the
// text flows through the universal-ingest route with source=phone_call
// so the parser prioritises prep-instruction extraction and stamps
// `info_source: "phone"` on every prep item.
//
// Voice capture records audio with MediaRecorder and uploads it to
// /api/ai/transcribe (Whisper) when the patient stops. The transcript
// is appended to the textarea once — no streaming, so the patient
// never sees mid-utterance text repeating.

export function PhoneCallNote({
  onDraft,
}: {
  onDraft: (draft: IngestDraft) => void;
}) {
  const locale = useLocale();
  const L = useL();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const voice = useVoiceTranscription({
    locale,
    source: "phone_note",
    onTranscribed: (chunk) =>
      setText((cur) => (cur ? `${cur} ${chunk}` : chunk)),
  });
  const recording = voice?.status === "recording";
  const transcribing = voice?.status === "transcribing";

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ draft: IngestDraft }>(
        "/api/ai/ingest-universal",
        {
          text: `Source: phone call.\n\n${text}`,
          source: "paste",
          today: todayISO(),
          locale,
        },
      );
      onDraft(data.draft);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-900">
          <Phone className="h-3.5 w-3.5 text-[var(--tide-2)]" />
          {L("Note from a phone call", "电话记录")}
        </div>
        <p className="text-[12px] text-ink-500">
          {L(
            "Just got off the phone with the clinic? Type (or dictate) what they said — we'll pull out appointments and prep instructions.",
            "刚和诊所通完电话？把要点说出来或打字录入 —— 会自动识别预约和准备事项。",
          )}
        </p>

        <Field label={L("What did they tell you?", "他们说了什么？")}>
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={L(
              "e.g. Sumi called — PET CT tomorrow 7am at Epworth Freemasons, 6-hour strict fast. Liver biopsy Tuesday 10am, fasting. Chemo Wednesday, prep to come.",
              "例如：Sumi 来电，明天 7 点 Epworth Freemasons PET CT，6 小时严格禁食。周二 10 点肝活检，需禁食。周三化疗，准备事项稍后告知。",
            )}
            disabled={busy || recording}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={submit} disabled={busy || !text.trim() || recording || transcribing}>
            {busy
              ? L("Reading…", "正在识别…")
              : L("Save", "保存")}
          </Button>
          {voice && (
            <Button
              variant={recording ? "danger" : "secondary"}
              onClick={() => {
                if (recording) voice.stop();
                else void voice.start();
              }}
              disabled={busy || transcribing}
              size="md"
            >
              {recording ? (
                <>
                  <MicOff className="h-3.5 w-3.5" />
                  {L("Stop dictating", "停止口述")}
                </>
              ) : transcribing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {L("Transcribing…", "识别中…")}
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" />
                  {L("Dictate", "口述")}
                </>
              )}
            </Button>
          )}
          {busy && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {L("Reading…", "正在识别…")}
            </span>
          )}
        </div>

        {(error || voice?.error) && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-2.5 text-[12.5px] text-[var(--warn)]"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error ?? voice?.error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
