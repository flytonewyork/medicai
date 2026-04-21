"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, TextInput } from "~/components/ui/field";
import { useLocale } from "~/hooks/use-translate";
import { runEngineAndPersist } from "~/lib/rules/engine";
import type { PendingResult, PendingResultCategory } from "~/types/clinical";
import { todayISO, formatDate } from "~/lib/utils/date";
import { Clock, Check, Trash2 } from "lucide-react";
import { cn } from "~/lib/utils/cn";

const CATEGORIES: PendingResultCategory[] = [
  "imaging",
  "lab",
  "ctdna",
  "ngs",
  "referral",
  "other",
];

export default function PendingResultsPage() {
  const locale = useLocale();
  const rows = useLiveQuery(() =>
    db.pending_results.orderBy("ordered_date").reverse().toArray(),
  );

  const [testName, setTestName] = useState("");
  const [category, setCategory] = useState<PendingResultCategory>("imaging");
  const [orderedDate, setOrderedDate] = useState(todayISO());
  const [expectedBy, setExpectedBy] = useState("");
  const [site, setSite] = useState("");
  const [notes, setNotes] = useState("");

  async function create() {
    if (!testName.trim()) return;
    await db.pending_results.add({
      test_name: testName.trim(),
      category,
      ordered_date: orderedDate,
      expected_by: expectedBy || undefined,
      site: site || undefined,
      notes: notes || undefined,
      received: false,
      created_at: now(),
      updated_at: now(),
    });
    setTestName("");
    setExpectedBy("");
    setSite("");
    setNotes("");
    await runEngineAndPersist();
  }

  async function markReceived(row: PendingResult) {
    if (!row.id) return;
    await db.pending_results.update(row.id, {
      received: true,
      received_date: todayISO(),
      updated_at: now(),
    });
    await runEngineAndPersist();
  }

  async function remove(id: number | undefined) {
    if (!id) return;
    await db.pending_results.delete(id);
  }

  const open = (rows ?? []).filter((r) => !r.received);
  const done = (rows ?? []).filter((r) => r.received);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "待出结果 / 转诊" : "Pending results & referrals"}
        subtitle={
          locale === "zh"
            ? "未按预期出结果的项目会生成提醒。"
            : "Any item past its expected-by date fires a zone alert."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{locale === "zh" ? "添加项目" : "Add an item"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field
            label={locale === "zh" ? "检查 / 转诊名称" : "Test or referral name"}
          >
            <TextInput
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="e.g. CT chest / abdo / pelvis"
            />
          </Field>
          <Field label={locale === "zh" ? "类别" : "Category"}>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as PendingResultCategory)
              }
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label={locale === "zh" ? "下单日期" : "Ordered"}>
            <TextInput
              type="date"
              value={orderedDate}
              onChange={(e) => setOrderedDate(e.target.value)}
            />
          </Field>
          <Field label={locale === "zh" ? "预计结果前" : "Expected by"}>
            <TextInput
              type="date"
              value={expectedBy}
              onChange={(e) => setExpectedBy(e.target.value)}
            />
          </Field>
          <Field label={locale === "zh" ? "机构 / 地点" : "Site"}>
            <TextInput value={site} onChange={(e) => setSite(e.target.value)} />
          </Field>
          <Field label={locale === "zh" ? "备注" : "Notes"}>
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Button onClick={create} disabled={!testName.trim()}>
              {locale === "zh" ? "添加" : "Add"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
          {locale === "zh" ? "未收到" : "Open"} ({open.length})
        </h2>
        {open.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
            {locale === "zh" ? "没有待出结果。" : "Nothing pending."}
          </div>
        )}
        <ul className="space-y-2">
          {open.map((r) => {
            const overdue = isOverdue(r);
            return (
              <li
                key={r.id}
                className={cn(
                  "flex items-center justify-between rounded-xl border bg-white p-4 dark:bg-slate-900",
                  overdue
                    ? "border-amber-400 dark:border-amber-800"
                    : "border-slate-200 dark:border-slate-800",
                )}
              >
                <div className="space-y-1">
                  <div className="text-sm font-medium">{r.test_name}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{r.category}</span>
                    <span>
                      {locale === "zh" ? "下单" : "ordered"}{" "}
                      {formatDate(r.ordered_date, locale)}
                    </span>
                    {r.expected_by && (
                      <span>
                        {locale === "zh" ? "预计" : "expected"}{" "}
                        {formatDate(r.expected_by, locale)}
                      </span>
                    )}
                    {r.site && <span>{r.site}</span>}
                    {overdue && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        <Clock className="h-3 w-3" />
                        {locale === "zh" ? "超期" : "overdue"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => markReceived(r)}
                  >
                    <Check className="h-4 w-4" />
                    {locale === "zh" ? "已收到" : "Received"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(r.id)}
                    aria-label="delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            {locale === "zh" ? "已收到" : "Received"} ({done.length})
          </h2>
          <ul className="space-y-2">
            {done.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60"
              >
                <span>
                  {r.test_name} ·{" "}
                  {r.received_date ? formatDate(r.received_date, locale) : ""}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(r.id)}
                  aria-label="delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function isOverdue(r: PendingResult): boolean {
  if (r.received) return false;
  const expectedByMs = r.expected_by
    ? Date.parse(r.expected_by)
    : Date.parse(r.ordered_date) + 14 * 24 * 3600 * 1000;
  if (Number.isNaN(expectedByMs)) return false;
  return Date.now() > expectedByMs;
}
