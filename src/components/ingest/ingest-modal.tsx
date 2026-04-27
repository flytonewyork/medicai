"use client";

import { create } from "zustand";
import { useEffect, useState } from "react";
import { useLocale, pickL } from "~/hooks/use-translate";
import { UniversalDrop } from "~/components/ingest/universal-drop";
import { PhoneCallNote } from "~/components/ingest/phone-note";
import { CalendarSubscribe } from "~/components/ingest/calendar-subscribe";
import { PreviewDiff } from "~/components/ingest/preview-diff";
import type { IngestApplyResult, IngestDraft } from "~/types/ingest";
import { X, Phone, FileUp, Calendar } from "lucide-react";
import { cn } from "~/lib/utils/cn";

// A globally-mountable ingest modal. Anything in the app can flip
// `useIngestModal.getState().open()` to surface the same drop /
// phone-note / paste flow without sending the user to /ingest.
//
// State lives in zustand so the AddFab (and any future trigger) just
// imports `useIngestModal` and calls `open()`.

interface IngestModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useIngestModal = create<IngestModalState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

type Tab = "phone" | "drop" | "calendar";

export function IngestModal() {
  const isOpen = useIngestModal((s) => s.isOpen);
  const close = useIngestModal((s) => s.close);
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("phone");
  const [draft, setDraft] = useState<IngestDraft | null>(null);
  const [results, setResults] = useState<IngestApplyResult[] | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDraft(null);
      setResults(null);
      setTab("phone");
    }
  }, [isOpen]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Esc closes the modal (only when no draft is mid-review — we
  // don't want a stray Esc to throw away parsed work).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !draft) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, draft, close]);

  if (!isOpen) return null;
  const L = pickL(locale);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-ink-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={L("Ingest", "导入")}
    >
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!draft) close();
        }}
        aria-hidden
      />
      <div className="relative my-4 w-full max-w-2xl rounded-[var(--r-lg)] bg-paper-2 shadow-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-[var(--r-lg)] border-b border-ink-100 bg-paper-2/95 px-4 py-3 backdrop-blur">
          <div>
            <div className="serif text-[16px] text-ink-900">
              {L("Add to Anchor", "导入到 Anchor")}
            </div>
            <p className="text-[11.5px] text-ink-500">
              {L(
                "Paste, snap, or dictate — Claude classifies and proposes changes; nothing saves without your tap.",
                "粘贴、拍照或口述 —— Claude 分类并提出变更，确认后才保存。",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => close()}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100/60 hover:text-ink-900"
            aria-label={L("Close", "关闭")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-4">
          {!draft && !results && (
            <>
              <div className="mb-3 flex gap-1 rounded-full bg-ink-100 p-1 text-[12px]">
                <TabButton
                  active={tab === "phone"}
                  onClick={() => setTab("phone")}
                  icon={Phone}
                  label={L("Phone call", "电话记录")}
                />
                <TabButton
                  active={tab === "drop"}
                  onClick={() => setTab("drop")}
                  icon={FileUp}
                  label={L("Doc / photo", "文档 / 照片")}
                />
                <TabButton
                  active={tab === "calendar"}
                  onClick={() => setTab("calendar")}
                  icon={Calendar}
                  label={L("Calendar", "日历")}
                />
              </div>
              {tab === "phone" && <PhoneCallNote onDraft={setDraft} />}
              {tab === "drop" && <UniversalDrop onDraft={setDraft} />}
              {tab === "calendar" && <CalendarSubscribe onDraft={setDraft} />}
            </>
          )}

          {draft && (
            <PreviewDiff
              draft={draft}
              onApplied={setResults}
              onDiscard={() => {
                setDraft(null);
                setResults(null);
              }}
            />
          )}

          {results && !draft && (
            <div className="space-y-3 text-center">
              <p className="text-[14px] font-semibold text-ink-900">
                {L("Done", "完成")}
              </p>
              <p className="text-[12px] text-ink-500">
                {L(
                  `${results.filter((r) => r.ok).length} of ${results.length} change(s) applied.`,
                  `已应用 ${results.filter((r) => r.ok).length} / ${results.length} 项变更。`,
                )}
              </p>
              <button
                type="button"
                onClick={close}
                className="rounded-md bg-ink-900 px-4 py-2 text-[13px] text-paper hover:brightness-110"
              >
                {L("Close", "关闭")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "bg-paper text-ink-900 shadow-sm"
          : "text-ink-500 hover:text-ink-800",
      )}
      aria-pressed={active}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
