"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import type {
  Appointment,
  AppointmentLinkedRecord,
  AppointmentLinkedRecordKind,
} from "~/types/appointment";
import {
  Syringe,
  TestTube2,
  Clock,
  ScanLine,
  Dna,
  Pill,
  Gavel,
  ListTodo,
  ExternalLink,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

// Shows every cross-module record an appointment is linked to. A
// chemo appointment → its treatment cycle; a blood-test appointment
// → the pending lab panel; a past scan → the imaging report row.
// Renders as tap-through chips with a kind-specific icon and a
// short, live label pulled from the target row.
//
// Read-only in this slice — ingest ops propose the links, Dexie
// writes them. Manual editing comes in a follow-up PR.

const KIND_ICON: Record<
  AppointmentLinkedRecordKind,
  React.ComponentType<{ className?: string }>
> = {
  treatment_cycle: Syringe,
  lab_result: TestTube2,
  pending_result: Clock,
  imaging: ScanLine,
  ctdna_result: Dna,
  medication: Pill,
  decision: Gavel,
  task: ListTodo,
};

const KIND_LABEL: Record<
  AppointmentLinkedRecordKind,
  { en: string; zh: string }
> = {
  treatment_cycle: { en: "Cycle", zh: "疗程" },
  lab_result: { en: "Lab", zh: "化验" },
  pending_result: { en: "Pending", zh: "待出" },
  imaging: { en: "Imaging", zh: "影像" },
  ctdna_result: { en: "ctDNA", zh: "ctDNA" },
  medication: { en: "Med", zh: "用药" },
  decision: { en: "Decision", zh: "决定" },
  task: { en: "Task", zh: "任务" },
};

const KIND_HREF: Record<AppointmentLinkedRecordKind, string> = {
  treatment_cycle: "/treatment",
  lab_result: "/labs",
  pending_result: "/ingest/pending",
  imaging: "/reports",
  ctdna_result: "/labs",
  medication: "/medications/log",
  decision: "/",
  task: "/tasks",
};

export function LinkedRecords({ appt }: { appt: Appointment }) {
  const locale = useLocale();
  const links = appt.linked_records ?? [];
  if (links.length === 0) return null;

  return (
    <div>
      <div className="mono mb-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-400">
        {locale === "zh" ? "关联记录" : "Linked records"}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {links.map((link, i) => (
          <li key={`${link.kind}-${link.local_id}-${i}`}>
            <LinkedChip link={link} locale={locale} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinkedChip({
  link,
  locale,
}: {
  link: AppointmentLinkedRecord;
  locale: "en" | "zh";
}) {
  const Icon = KIND_ICON[link.kind];
  const label = useLiveLabel(link, locale);
  const href = KIND_HREF[link.kind];
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-paper-2 px-2.5 py-1 text-[11.5px] text-ink-800 transition-colors",
        "hover:border-ink-400 hover:bg-ink-100/40",
      )}
    >
      <Icon className="h-3 w-3 text-[var(--tide-2)]" />
      <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-ink-400">
        {KIND_LABEL[link.kind][locale]}
      </span>
      <span className="truncate">{label}</span>
      <ExternalLink className="h-2.5 w-2.5 text-ink-400" />
    </Link>
  );
}

// Resolves the linked row to a short human label. Falls back to the
// provided `link.label` when the referenced row isn't loaded yet
// (first-paint on a cold cache) so the chip never flashes blank.
function useLiveLabel(
  link: AppointmentLinkedRecord,
  locale: "en" | "zh",
): string {
  const fallback = link.label ?? `#${link.local_id}`;
  const row = useLiveQuery(async () => {
    switch (link.kind) {
      case "treatment_cycle":
        return (await db.treatment_cycles.get(link.local_id)) ?? null;
      case "lab_result":
        return (await db.labs.get(link.local_id)) ?? null;
      case "pending_result":
        return (await db.pending_results.get(link.local_id)) ?? null;
      case "imaging":
        return (await db.imaging.get(link.local_id)) ?? null;
      case "ctdna_result":
        return (await db.ctdna_results.get(link.local_id)) ?? null;
      case "medication":
        return (await db.medications.get(link.local_id)) ?? null;
      case "decision":
        return (await db.decisions.get(link.local_id)) ?? null;
      case "task":
        return (await db.patient_tasks.get(link.local_id)) ?? null;
    }
  }, [link.kind, link.local_id]);

  if (!row) return fallback;
  switch (link.kind) {
    case "treatment_cycle":
      return `${locale === "zh" ? "第" : "Cycle "}${
        (row as { cycle_number?: number }).cycle_number ?? "?"
      }`;
    case "lab_result":
      return (row as { date?: string }).date ?? fallback;
    case "pending_result":
      return (
        (row as { test_name?: string }).test_name ??
        (row as { category?: string }).category ??
        fallback
      );
    case "imaging":
      return `${(row as { modality?: string }).modality ?? "Imaging"} · ${
        (row as { date?: string }).date ?? "?"
      }`;
    case "ctdna_result":
      return `${(row as { platform?: string }).platform ?? "ctDNA"} · ${
        (row as { date?: string }).date ?? "?"
      }`;
    case "medication":
      return (row as { drug_id?: string }).drug_id ?? fallback;
    case "decision":
      return (
        (row as { title?: string }).title ??
        (row as { decision?: string }).decision ??
        fallback
      );
    case "task":
      return (row as { title?: string }).title ?? fallback;
  }
}
