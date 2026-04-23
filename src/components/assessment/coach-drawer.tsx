"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils/cn";
import { useLocale } from "~/hooks/use-translate";
import { askCoach, type CoachContext, type CoachMessage } from "~/lib/ai/coach";
import { Sparkles, X, Send, Loader2 } from "lucide-react";

export function CoachDrawer({ context }: { context: CoachContext }) {
  const locale = useLocale();
  const settings = useLiveQuery(() => db.settings.toArray());
  const model = settings?.[0]?.default_ai_model ?? "claude-opus-4-7";

  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!input.trim() || busy) return;
    const userMsg: CoachMessage = { role: "user", content: input.trim() };
    setHistory((h) => [...h, userMsg]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const reply = await askCoach({
        model,
        context,
        history: [...history, userMsg],
        locale,
      });
      setHistory((h) => [...h, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {locale === "zh" ? "问问 AI 教练" : "Ask the AI coach"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-900/30 backdrop-blur-sm">
          <div
            onClick={() => setOpen(false)}
            className="flex-1"
            aria-hidden
          />
          <aside className="flex w-full max-w-md flex-col bg-white shadow-xl dark:bg-slate-950">
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-slate-500" />
                <div className="text-sm font-semibold">
                  {locale === "zh" ? "AI 教练" : "AI coach"}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="close"
                className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
              <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500 dark:border-slate-700">
                <div className="font-medium text-slate-700 dark:text-slate-300">
                  {context.stepTitle}
                </div>
                <div className="mt-1 whitespace-pre-line">
                  {context.stepInstructions}
                </div>
              </div>
              {history.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg px-3 py-2",
                    m.role === "user"
                      ? "ml-6 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "mr-6 bg-slate-50 dark:bg-slate-900",
                  )}
                >
                  {m.content}
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {locale === "zh" ? "思考中…" : "Thinking…"}
                </div>
              )}
              {error && (
                <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
                  {error}
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-end gap-2">
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    locale === "zh"
                      ? "在这一步有什么问题？"
                      : "Any question about this step?"
                  }
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                />
                <Button onClick={send} disabled={busy || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
