"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useL } from "~/hooks/use-translate";
import { todayISO, localeTag } from "~/lib/utils/date";
import { postJson } from "~/lib/utils/http";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, Textarea } from "~/components/ui/field";
import { Mic, MicOff, AlertCircle, Loader2, Phone } from "lucide-react";
import type { IngestDraft } from "~/types/ingest";

// Quick-capture surface for phone-call instructions. The patient (or
// the carer on the line) types or dictates what they just heard; the
// text flows through the universal-ingest route with source=phone_call
// so the parser prioritises prep-instruction extraction and stamps
// `info_source: "phone"` on every prep item.
//
// Voice capture uses the Web Speech API (webkitSpeechRecognition on
// Safari). Hidden entirely when the browser doesn't support it so we
// never render a button that can't work.

type SR = (typeof window) extends { webkitSpeechRecognition: infer T }
  ? T
  : unknown;

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognition)
  | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
}

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
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const canSpeech = typeof getSpeechRecognitionCtor() === "function";

  useEffect(() => {
    return () => {
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  function startListening() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = localeTag(locale);
    rec.onresult = (ev) => {
      let delta = "";
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const res = ev.results[i];
        if (res && res[0] && res.isFinal) delta += res[0].transcript;
      }
      if (delta) setText((prev) => (prev ? `${prev} ${delta}` : delta));
    };
    rec.onerror = (e) => {
      setError(String((e as unknown as { error?: string }).error ?? "speech-error"));
      setListening(false);
    };
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }
  function stopListening() {
    recRef.current?.stop();
    setListening(false);
  }

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
            disabled={busy}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={submit} disabled={busy || !text.trim()}>
            {busy
              ? L("Reading…", "正在识别…")
              : L("Save", "保存")}
          </Button>
          {canSpeech && (
            <Button
              variant={listening ? "danger" : "secondary"}
              onClick={listening ? stopListening : startListening}
              disabled={busy}
              size="md"
            >
              {listening ? (
                <>
                  <MicOff className="h-3.5 w-3.5" />
                  {L("Stop dictating", "停止口述")}
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

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-2.5 text-[12.5px] text-[var(--warn)]"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
