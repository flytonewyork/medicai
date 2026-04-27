"use client";

import { useLocale, useL } from "~/hooks/use-translate";
import {
  PREP_KIND_LABEL,
} from "~/lib/appointments/prep";
import type {
  AppointmentPrep,
  AppointmentPrepKind,
  AppointmentPrepSource,
} from "~/types/appointment";
import { Field, TextInput } from "~/components/ui/field";
import { Button } from "~/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

// Reusable prep-item editor — used in the appointment form (on
// create / edit) and surfaced on the detail page when the patient
// wants to add a just-heard-on-the-phone instruction without
// opening full edit mode.

const KIND_OPTIONS: AppointmentPrepKind[] = [
  "fast",
  "medication_hold",
  "medication_take",
  "arrive_early",
  "bring",
  "sample",
  "transport",
  "companion",
  "consent",
  "pre_scan_contrast",
  "other",
];

const SOURCE_OPTIONS: AppointmentPrepSource[] = [
  "phone",
  "email",
  "letter",
  "in_person",
  "other",
];

const SOURCE_LABEL: Record<AppointmentPrepSource, { en: string; zh: string }> = {
  phone: { en: "Phone", zh: "电话" },
  email: { en: "Email", zh: "邮件" },
  letter: { en: "Letter", zh: "信函" },
  in_person: { en: "In person", zh: "当面" },
  other: { en: "Other", zh: "其他" },
};

export function PrepEditor({
  value,
  onChange,
}: {
  value: AppointmentPrep[];
  onChange: (next: AppointmentPrep[]) => void;
}) {
  const locale = useLocale();
  const L = useL();

  function patch(i: number, over: Partial<AppointmentPrep>) {
    const next = value.slice();
    const row = next[i];
    if (!row) return;
    next[i] = { ...row, ...over };
    onChange(next);
  }
  function add() {
    onChange([
      ...value,
      { kind: "fast", description: "", info_source: "phone" },
    ]);
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-[12px] text-ink-500">
          {L(
            "No prep items yet. Add any fasts, meds to hold, or things to bring.",
            "暂无准备事项。添加禁食、停药或需要携带的物品等。",
          )}
        </p>
      )}

      <ul className="space-y-2">
        {value.map((item, i) => (
          <li
            key={i}
            className="rounded-[var(--r-md)] border border-ink-200 bg-paper-2 p-3"
          >
            <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto] sm:items-start">
              <Field label={L("Kind", "类型")}>
                <select
                  value={item.kind}
                  onChange={(e) =>
                    patch(i, { kind: e.target.value as AppointmentPrepKind })
                  }
                  className="h-10 w-full rounded-md border border-ink-200 bg-paper px-2 text-[13px]"
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {PREP_KIND_LABEL[k][locale]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={L("What", "具体内容")}>
                <TextInput
                  value={item.description}
                  onChange={(e) =>
                    patch(i, { description: e.target.value })
                  }
                  placeholder={L(
                    "e.g. 6-hour fast, no food or drink",
                    "例如：6 小时禁食，不进食饮水",
                  )}
                />
              </Field>
              <div className="flex items-end justify-end pb-1">
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100/60 hover:text-[var(--warn)]"
                  aria-label={L("Remove", "删除")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Field label={L("Hours before", "提前小时数")}>
                <TextInput
                  type="number"
                  inputMode="decimal"
                  value={item.hours_before ?? ""}
                  onChange={(e) =>
                    patch(i, {
                      hours_before:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                  placeholder={L("e.g. 6", "例如：6")}
                />
              </Field>
              <Field label={L("Starts at (optional)", "起始时间（可选）")}>
                <TextInput
                  type="datetime-local"
                  value={toLocalInput(item.starts_at)}
                  onChange={(e) =>
                    patch(i, {
                      starts_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : undefined,
                    })
                  }
                />
              </Field>
              <Field label={L("Told to us via", "来源")}>
                <select
                  value={item.info_source ?? "phone"}
                  onChange={(e) =>
                    patch(i, {
                      info_source: e.target.value as AppointmentPrepSource,
                    })
                  }
                  className="h-10 w-full rounded-md border border-ink-200 bg-paper px-2 text-[13px]"
                >
                  {SOURCE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {SOURCE_LABEL[s][locale]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </li>
        ))}
      </ul>

      <Button variant="ghost" onClick={add} size="md">
        <Plus className="h-3.5 w-3.5" />
        {L("Add prep item", "新增准备事项")}
      </Button>
    </div>
  );
}

function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
