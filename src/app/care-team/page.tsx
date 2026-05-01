"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader, SectionHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import type {
  CareTeamContact,
  CareTeamContactKind,
} from "~/types/clinical";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { cn } from "~/lib/utils/cn";
import { todayISO } from "~/lib/utils/date";

const KIND_LABELS: Record<CareTeamContactKind, { en: string; zh: string }> = {
  clinic_visit: { en: "Clinic visit", zh: "门诊" },
  clinician_call: { en: "Phone / telehealth", zh: "电话 / 远程医疗" },
  specialist_visit: { en: "Specialist visit", zh: "专科门诊" },
  community_nurse: { en: "Community nurse", zh: "社区护理" },
  allied_health: { en: "Allied health", zh: "联合健康" },
  hospital_admission: { en: "Hospital admission", zh: "住院" },
  emergency_department: { en: "Emergency dept", zh: "急诊" },
  pharmacist: { en: "Pharmacist", zh: "药剂师" },
  other: { en: "Other", zh: "其他" },
};

const KIND_ORDER: CareTeamContactKind[] = [
  "clinic_visit",
  "clinician_call",
  "specialist_visit",
  "community_nurse",
  "allied_health",
  "hospital_admission",
  "emergency_department",
  "pharmacist",
  "other",
];

export default function CareTeamPage() {
  const locale = useLocale();
  const contacts = useLiveQuery(
    () => db.care_team_contacts.orderBy("date").reverse().toArray(),
    [],
  );
  const [editing, setEditing] = useState<CareTeamContact | null>(null);
  const [showForm, setShowForm] = useState(false);

  const lastContact = useMemo(() => {
    if (!contacts || contacts.length === 0) return null;
    return contacts[0];
  }, [contacts]);

  const daysSince = useMemo(() => {
    if (!lastContact) return null;
    return differenceInCalendarDays(new Date(), parseISO(lastContact.date));
  }, [lastContact]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "外部" : "External"}
        title={locale === "zh" ? "医疗团队记录" : "Care team log"}
      />

      <Card className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="eyebrow">
              {locale === "zh" ? "最近接触" : "Last contact"}
            </div>
            <div className="serif mt-1 text-[22px] text-ink-900">
              {lastContact
                ? `${daysSince ?? "?"} ${locale === "zh" ? "天前" : "days ago"}`
                : locale === "zh"
                  ? "尚无记录"
                  : "No contacts logged"}
            </div>
            {lastContact && (
              <div className="mt-1 text-sm text-ink-500">
                {KIND_LABELS[lastContact.kind][locale]}
                {lastContact.with_who ? ` · ${lastContact.with_who}` : ""}
                {" · "}
                {format(parseISO(lastContact.date), "d MMM yyyy")}
              </div>
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            {locale === "zh" ? "添加记录" : "Log contact"}
          </Button>
        </div>
      </Card>

      {showForm && (
        <ContactForm
          locale={locale}
          editing={editing}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <section className="space-y-2">
        <SectionHeader title={locale === "zh" ? "历史" : "History"} />
        {contacts && contacts.length > 0 ? (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                locale={locale}
                onEdit={() => {
                  setEditing(c);
                  setShowForm(true);
                }}
                onDelete={() => {
                  if (c.id) void db.care_team_contacts.delete(c.id);
                }}
              />
            ))}
          </ul>
        ) : (
          <Card className="p-5 text-sm text-ink-500">
            {locale === "zh"
              ? "暂无记录。首次门诊 / 电话后添加一条，系统即可开始追踪接触节奏。"
              : "No contacts yet. Add one after your next clinic call or visit so the app can track your support-network rhythm."}
          </Card>
        )}
      </section>
    </div>
  );
}

function ContactRow({
  contact,
  locale,
  onEdit,
  onDelete,
}: {
  contact: CareTeamContact;
  locale: "en" | "zh";
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li>
      <Card className="flex items-start gap-3 px-4 py-3">
        <div className="flex h-8 w-10 shrink-0 flex-col items-center justify-center rounded-md bg-paper-2 text-center">
          <span className="mono text-[9px] uppercase tracking-[0.1em] text-ink-500">
            {format(parseISO(contact.date), "MMM")}
          </span>
          <span className="text-[13px] font-semibold text-ink-900 leading-tight">
            {format(parseISO(contact.date), "d")}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-ink-900">
              {KIND_LABELS[contact.kind][locale]}
            </span>
            {contact.with_who && (
              <span className="text-[12px] text-ink-500">
                · {contact.with_who}
              </span>
            )}
            {contact.follow_up_needed && (
              <span className="mono rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[9.5px] uppercase tracking-[0.12em] text-[var(--warn)]">
                {locale === "zh" ? "需随访" : "follow-up"}
              </span>
            )}
          </div>
          {contact.notes && (
            <p className="mt-1 text-[12px] text-ink-700">{contact.notes}</p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="text-[11px] text-ink-500 hover:text-ink-900"
            >
              {locale === "zh" ? "编辑" : "Edit"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-[11px] text-ink-400 hover:text-[var(--warn)]"
            >
              {locale === "zh" ? "删除" : "Delete"}
            </button>
          </div>
        </div>
      </Card>
    </li>
  );
}

function ContactForm({
  locale,
  editing,
  onSaved,
  onCancel,
}: {
  locale: "en" | "zh";
  editing: CareTeamContact | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(
    editing?.date ?? todayISO(),
  );
  const [kind, setKind] = useState<CareTeamContactKind>(
    editing?.kind ?? "clinic_visit",
  );
  const [withWho, setWithWho] = useState(editing?.with_who ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [followUp, setFollowUp] = useState(editing?.follow_up_needed ?? false);

  const save = async () => {
    const at = now();
    const payload: CareTeamContact = {
      date,
      kind,
      with_who: withWho || undefined,
      notes: notes || undefined,
      follow_up_needed: followUp,
      created_at: editing?.created_at ?? at,
      updated_at: at,
    };
    if (editing?.id) {
      await db.care_team_contacts.update(editing.id, payload);
    } else {
      await db.care_team_contacts.add(payload);
    }
    onSaved();
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="eyebrow">
        {editing
          ? locale === "zh"
            ? "编辑记录"
            : "Edit contact"
          : locale === "zh"
            ? "新记录"
            : "New contact"}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-ink-500">
            {locale === "zh" ? "日期" : "Date"}
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-ink-200 bg-paper px-2 py-1.5 text-[13px]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-ink-500">
            {locale === "zh" ? "类型" : "Kind"}
          </span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CareTeamContactKind)}
            className="rounded-md border border-ink-200 bg-paper px-2 py-1.5 text-[13px]"
          >
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k][locale]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] md:col-span-2">
          <span className="text-ink-500">
            {locale === "zh" ? "联系人 / 机构" : "Who / service"}
          </span>
          <input
            type="text"
            value={withWho}
            onChange={(e) => setWithWho(e.target.value)}
            placeholder={locale === "zh" ? "例如 Dr Lee" : "e.g. Dr Lee"}
            className="rounded-md border border-ink-200 bg-paper px-2 py-1.5 text-[13px]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] md:col-span-2">
          <span className="text-ink-500">
            {locale === "zh" ? "笔记" : "Notes"}
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-md border border-ink-200 bg-paper px-2 py-1.5 text-[13px]"
          />
        </label>
        <label className="flex items-center gap-2 text-[12px] md:col-span-2">
          <input
            type="checkbox"
            checked={followUp}
            onChange={(e) => setFollowUp(e.target.checked)}
          />
          <span>
            {locale === "zh" ? "需要后续跟进" : "Follow-up needed"}
          </span>
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {locale === "zh" ? "取消" : "Cancel"}
        </Button>
        <Button variant="primary" size="sm" onClick={() => void save()}>
          {locale === "zh" ? "保存" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
