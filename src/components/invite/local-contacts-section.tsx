"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import {
  addCareTeamMember,
  findCareTeamMemberForAccount,
  hydrateFromLegacySettings,
  removeCareTeamMember,
  updateCareTeamMember,
} from "~/lib/care-team/registry";
import { listHouseholdMembers } from "~/lib/supabase/households";
import { useHousehold } from "~/hooks/use-household";
import type {
  CareTeamMember,
  CareTeamRole,
} from "~/types/care-team";
import type { HouseholdMemberWithProfile } from "~/types/household";
import { useLocale } from "~/hooks/use-translate";
import { Field, TextInput } from "~/components/ui/field";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Star,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  CircleAlert,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";
import type { LocalizedText } from "~/types/localized";

// Local contacts directory — phone numbers, specialties, and notes for
// people in the patient's external care orbit (oncologist, surgeon, GP,
// on-call, allied health). Lives on /carers as the "no Anchor account
// needed" complement to the household-membership list.
//
// Anchor account invites have been deliberately STRIPPED from this
// component — that's now the job of `InviteCarerFlow` on the same page.
// Local contacts here are exactly that: local. The previous version
// conflated "person with a phone number" with "person with an Anchor
// account" and surfaced an "Also send invite" checkbox that duplicated
// the dedicated issuance flow.
//
// The auto-sync from household_memberships → care_team rows still runs
// (so an Anchor member's name appears in this list as a "phone book"
// entry too), but role / invite state changes flow through the
// MembersList component, not here.

const ROLES: CareTeamRole[] = [
  "family",
  "oncologist",
  "surgeon",
  "gp",
  "nurse",
  "allied_health",
  "other",
];

const ROLE_LABELS: Record<CareTeamRole, LocalizedText> = {
  family: { en: "Family", zh: "家人" },
  oncologist: { en: "Oncologist", zh: "肿瘤科" },
  surgeon: { en: "Surgeon", zh: "外科" },
  gp: { en: "GP", zh: "全科医师" },
  nurse: { en: "Nurse", zh: "护理" },
  allied_health: { en: "Allied health", zh: "康复/营养" },
  other: { en: "Other", zh: "其他" },
};

interface DraftMember {
  id?: number;
  name: string;
  role: CareTeamRole;
  specialty: string;
  organisation: string;
  phone: string;
  email: string;
  notes: string;
  is_lead: boolean;
}

const EMPTY_DRAFT: DraftMember = {
  name: "",
  role: "oncologist",
  specialty: "",
  organisation: "",
  phone: "",
  email: "",
  notes: "",
  is_lead: false,
};

export function LocalContactsSection() {
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  const members = useLiveQuery(() => db.care_team.toArray(), []);
  const settings = useLiveQuery(() => db.settings.toArray(), []);

  const { membership } = useHousehold();
  const householdId = membership?.household_id ?? null;

  const [supaMembers, setSupaMembers] = useState<HouseholdMemberWithProfile[]>([]);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<DraftMember>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One-time hydrate from legacy managing_oncologist / hospital_name once
  // settings are loaded and the registry is empty.
  useEffect(() => {
    const s = settings?.[0];
    if (!s || members === undefined) return;
    if (members.length > 0) return;
    void hydrateFromLegacySettings({
      managing_oncologist: s.managing_oncologist,
      managing_oncologist_phone: s.managing_oncologist_phone,
      hospital_name: s.hospital_name,
    });
  }, [settings, members]);

  // Pull household members so we can mirror them as phone-book entries.
  const reloadSupabase = useCallback(async () => {
    if (!householdId) {
      setSupaMembers([]);
      return;
    }
    const m = await listHouseholdMembers(householdId);
    setSupaMembers(m);
  }, [householdId]);
  useEffect(() => {
    void reloadSupabase();
  }, [reloadSupabase]);

  // Sync: ensure every household account has a corresponding care_team row
  // so the local directory is the single source of truth for "who's in
  // the support orbit". Role assignment for an Anchor account is mirrored
  // into the local registry as `family`; clinicians stay as `other`.
  useEffect(() => {
    if (members === undefined) return;
    void (async () => {
      for (const m of supaMembers) {
        const matched = await findCareTeamMemberForAccount({
          user_id: m.user_id,
        });
        if (matched?.id) {
          if (
            matched.account_user_id !== m.user_id ||
            matched.account_status !== "active"
          ) {
            await updateCareTeamMember(matched.id, {
              account_user_id: m.user_id,
              account_status: "active",
              pending_invite_id: undefined,
              pending_invite_token: undefined,
            });
          }
        } else {
          await addCareTeamMember({
            name:
              m.profile.display_name?.trim() ||
              (locale === "zh" ? "家庭成员" : "Family member"),
            role: m.role === "clinician" ? "other" : "family",
            notes: m.profile.care_role_label?.trim() || undefined,
            account_user_id: m.user_id,
            account_status: "active",
          });
        }
      }
    })();
  }, [supaMembers, members, locale]);

  const grouped = useMemo(() => {
    const byRole = new Map<CareTeamRole, CareTeamMember[]>();
    for (const m of members ?? []) {
      const list = byRole.get(m.role) ?? [];
      list.push(m);
      byRole.set(m.role, list);
    }
    for (const list of byRole.values()) {
      list.sort((a, b) => {
        if (Boolean(a.is_lead) !== Boolean(b.is_lead)) {
          return a.is_lead ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    }
    return byRole;
  }, [members]);

  function startAdd() {
    setDraft(EMPTY_DRAFT);
    setEditing("new");
    setError(null);
  }

  function startEdit(m: CareTeamMember) {
    setDraft({
      id: m.id,
      name: m.name,
      role: m.role,
      specialty: m.specialty ?? "",
      organisation: m.organisation ?? "",
      phone: m.phone ?? "",
      email: m.email ?? "",
      notes: m.notes ?? "",
      is_lead: Boolean(m.is_lead),
    });
    setEditing(m.id ?? null);
    setError(null);
  }

  function cancel() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  async function save() {
    if (!draft.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draft.name.trim(),
        role: draft.role,
        specialty: draft.specialty.trim() || undefined,
        organisation: draft.organisation.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        email: draft.email.trim() || undefined,
        notes: draft.notes.trim() || undefined,
        is_lead: draft.is_lead,
      };
      if (editing === "new") {
        await addCareTeamMember(payload);
      } else if (typeof editing === "number") {
        await updateCareTeamMember(editing, payload);
      } else {
        cancel();
        return;
      }
      cancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        L(
          "Remove this contact from the local directory?",
          "从本地通讯录中移除此联系人？",
        ),
      )
    ) {
      return;
    }
    await removeCareTeamMember(id);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-ink-500">
          {L(
            "Phone numbers and notes for the people in the patient's care orbit who don't need an Anchor account — clinicians, on-call lines, allied health.",
            "无需 Anchor 账号的护理联系人通讯录 —— 医生、值班电话、康复 / 营养。",
          )}
        </p>
        {editing === null && (
          <Button onClick={startAdd} size="sm" variant="secondary">
            <Plus className="h-3.5 w-3.5" />
            {L("Add contact", "新增联系人")}
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[var(--warn)]/40 bg-[var(--warn-soft)] p-2.5 text-[12px] text-[var(--warn)]"
        >
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {editing !== null && (
        <DraftEditor
          draft={draft}
          onChange={setDraft}
          onSave={save}
          onCancel={cancel}
          saving={saving}
          locale={locale}
        />
      )}

      {members !== undefined && members.length === 0 && editing === null && (
        <Card>
          <CardContent className="py-4 text-center text-[12.5px] text-ink-500">
            {L(
              "No contacts yet. Add the oncologist, GP, and any after-hours numbers.",
              "暂无联系人。请添加肿瘤科、全科医师及夜间电话等。",
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {ROLES.map((role) => {
          const list = grouped.get(role) ?? [];
          if (list.length === 0) return null;
          return (
            <div key={role} className="space-y-1.5">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
                {ROLE_LABELS[role][locale]}
              </div>
              <ul className="divide-y divide-ink-100 rounded-md border border-ink-100 bg-paper">
                {list.map((m) => (
                  <li
                    key={`m-${m.id}`}
                    className="flex items-start gap-3 px-3 py-2.5 text-[13px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-ink-900">
                          {m.name}
                        </span>
                        {m.is_lead && (
                          <Star
                            className="h-3 w-3 fill-[var(--tide-2)] text-[var(--tide-2)]"
                            aria-label={L("Lead", "主要联系人")}
                          />
                        )}
                        {m.account_status === "active" && (
                          <span className="rounded-full bg-[var(--ok-soft)] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em] text-[var(--ok)]">
                            {L("Anchor account", "Anchor 账号")}
                          </span>
                        )}
                      </div>
                      {(m.specialty || m.organisation) && (
                        <div className="mt-0.5 text-[11.5px] text-ink-500">
                          {[m.specialty, m.organisation].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {(m.phone || m.email) && (
                        <div className="mt-0.5 text-[11.5px] text-ink-500">
                          {m.phone && (
                            <a href={`tel:${m.phone}`} className="underline">
                              {m.phone}
                            </a>
                          )}
                          {m.phone && m.email && " · "}
                          {m.email && (
                            <a href={`mailto:${m.email}`} className="underline">
                              {m.email}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100/40 hover:text-ink-900"
                        aria-label={L("Edit", "编辑")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => m.id && remove(m.id)}
                        className="rounded-md p-1.5 text-ink-500 hover:bg-[var(--warn-soft)] hover:text-[var(--warn)]"
                        aria-label={L("Remove", "移除")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DraftEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  locale,
}: {
  draft: DraftMember;
  onChange: (d: DraftMember) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  locale: "en" | "zh";
}) {
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <Field label={L("Name", "姓名")}>
          <TextInput
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder={L("Dr Michael Lee", "李医生")}
            autoFocus
          />
        </Field>

        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-400">
            {L("Role", "角色")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChange({ ...draft, role: r })}
                className={cn(
                  "h-8 rounded-full border px-3 text-[12px] font-medium",
                  draft.role === r
                    ? "border-ink-900 bg-ink-900 text-paper"
                    : "border-ink-200 bg-paper-2 text-ink-600 hover:border-ink-400",
                )}
              >
                {ROLE_LABELS[r][locale]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label={L("Specialty", "专业")}>
            <TextInput
              value={draft.specialty}
              onChange={(e) =>
                onChange({ ...draft, specialty: e.target.value })
              }
              placeholder={L("HPB surgeon", "肝胆胰外科")}
            />
          </Field>
          <Field label={L("Organisation", "机构")}>
            <TextInput
              value={draft.organisation}
              onChange={(e) =>
                onChange({ ...draft, organisation: e.target.value })
              }
              placeholder={L("Epworth Richmond", "Epworth Richmond")}
            />
          </Field>
          <Field label={L("Phone", "电话")}>
            <TextInput
              value={draft.phone}
              onChange={(e) => onChange({ ...draft, phone: e.target.value })}
              inputMode="tel"
            />
          </Field>
          <Field label={L("Email", "邮箱")}>
            <TextInput
              type="email"
              value={draft.email}
              onChange={(e) => onChange({ ...draft, email: e.target.value })}
            />
          </Field>
        </div>

        <Field label={L("Notes", "备注")}>
          <TextInput
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
            placeholder={L(
              "After-hours contact, preferred channel…",
              "下班后联系方式、偏好的沟通渠道……",
            )}
          />
        </Field>

        <label className="flex items-center gap-2 text-[12.5px] text-ink-700">
          <input
            type="checkbox"
            checked={draft.is_lead}
            onChange={(e) =>
              onChange({ ...draft, is_lead: e.target.checked })
            }
          />
          {L("Primary contact for this role", "此角色的主要联系人")}
        </label>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            <X className="h-4 w-4" />
            {L("Cancel", "取消")}
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || !draft.name.trim()}
            size="md"
          >
            <Check className="h-4 w-4" />
            {saving ? L("Saving…", "保存中…") : L("Save", "保存")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
