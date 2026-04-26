"use client";

import { useState } from "react";
import { useLocale } from "~/hooks/use-translate";
import {
  formatCitation,
  getSource,
  type Citation,
  type SourceId,
} from "~/lib/nutrition/sources";
import { cn } from "~/lib/utils/cn";

// Inline citation pill. Tap to expand the full reference inline so
// the family member can see *who* is recommending — Ryan Surace at
// Epworth Richmond, paper authors, the contact phone — rather than
// generic AI advice. Bilingual.

export function Cite({
  source,
  page,
  section,
}: {
  source: SourceId;
  page?: number;
  section?: string;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const c: Citation = { source_id: source, page, section };
  const label = formatCitation(c, locale);
  const src = getSource(source);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "mono inline-flex items-center gap-1 rounded-sm border border-ink-200 bg-paper-2/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-500 hover:border-ink-300 hover:text-ink-700",
        )}
        aria-expanded={open}
        aria-label={label}
      >
        {label}
      </button>
      {open && (
        <span className="absolute z-20 mt-1 block w-72 rounded-md border border-ink-100 bg-paper p-3 text-[11.5px] leading-snug text-ink-700 shadow-lg">
          <span className="block font-medium text-ink-900">
            {src.short_label}
          </span>
          {src.author && (
            <span className="mt-0.5 block text-ink-500">{src.author}</span>
          )}
          <span className="mt-1 block text-ink-600">{src.full_citation}</span>
          {src.url && (
            <a
              href={src.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all text-[var(--tide-2)] underline"
            >
              {src.url}
            </a>
          )}
          {src.contact && (
            <span className="mono mt-1 block text-[10px] text-ink-500">
              {locale === "zh" ? "联系：" : "Contact "}
              {src.contact}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

// Convenience: render a list of citations inline (space-separated).
export function CiteList({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {citations.map((c, i) => (
        <Cite key={i} source={c.source_id} page={c.page} section={c.section} />
      ))}
    </span>
  );
}
