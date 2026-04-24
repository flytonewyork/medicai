"use client";

import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { pickL } from "~/hooks/use-bilingual";
import { X, Plus } from "lucide-react";
import { cn } from "~/lib/utils/cn";

// Multi-chip attendee picker backed by the care-team registry. The user taps
// a chip to add the member, or types a free-text name (Enter / comma / tab)
// for someone who isn't on the team yet. Selected values are persisted as
// `attendees: string[]` on the appointment — the same shape the old text
// area produced, so read-only consumers don't need to change.

export function AttendeeChips({
  value,
  onChange,
  locale,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  locale: "en" | "zh";
}) {
  const team = useLiveQuery(() => db.care_team.toArray(), []);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const L = (en: string, zh: string) => pickL(locale, en, zh);

  const suggestions = useMemo(() => {
    const names = new Set(value.map((v) => v.trim().toLowerCase()));
    const q = query.trim().toLowerCase();
    return (team ?? [])
      .filter((m) => !!m.name && !names.has(m.name.trim().toLowerCase()))
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [team, value, query]);

  function add(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (value.some((v) => v.trim().toLowerCase() === trimmed.toLowerCase()))
      return;
    onChange([...value, trimmed]);
    setQuery("");
    inputRef.current?.focus();
  }

  function remove(index: number) {
    const next = value.slice();
    next.splice(index, 1);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-ink-200 bg-paper-2 p-2">
        {value.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--tide-soft)] px-2 py-1 text-[12px] text-[var(--tide-2)]"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove ${v}`}
              className="text-[var(--tide-2)]/70 hover:text-[var(--tide-2)]"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
              if (query.trim()) {
                e.preventDefault();
                add(query);
              }
            } else if (
              e.key === "Backspace" &&
              query === "" &&
              value.length > 0
            ) {
              e.preventDefault();
              remove(value.length - 1);
            }
          }}
          placeholder={
            value.length === 0
              ? L("Add from care team or type a name…", "从护理团队选择或输入姓名…")
              : L("Add another…", "再加一位…")
          }
          className="min-w-[10ch] flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-400"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((m) => (
            <button
              key={m.id ?? m.name}
              type="button"
              onClick={() => add(m.name)}
              className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-paper px-2 py-1 text-[11.5px] text-ink-700 hover:border-[var(--tide-2)] hover:text-[var(--tide-2)]"
            >
              <Plus className="h-3 w-3" />
              {m.name}
              {m.role && (
                <span className="mono text-[9px] uppercase tracking-[0.1em] text-ink-400">
                  · {m.role}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
