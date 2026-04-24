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
import {
  createInvite,
  inviteUrl,
  listHouseholdMembers,
  listInvites,
  revokeInvite,
} from "~/lib/supabase/households";
import { useHousehold } from "~/hooks/use-household";
import type {
  CareTeamMember,
  CareTeamRole,
} from "~/types/care-team";
import type {
  HouseholdInvite,
  HouseholdMemberWithProfile,
  HouseholdRole,
} from "~/types/household";
import { useLocale } from "~/hooks/use-translate";
import { Field, TextInput } from "~/components/ui/field";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Users,
  Star,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Copy,
  Mail,
  CircleAlert,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

const ROLES: CareTeamRole[] = [
  "family",
  "oncologist",
  "surgeon",
  "gp",
  "nurse",
  "allied_health",
  "other",
];

const ROLE_LABELS: Record<CareTeamRole, { en: string; zh: string }> = {
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
  send_invite: boolean;
}

const EMPTY_DRAFT: DraftMember = {
  name: "",
  role: "family",
  specialty: "",
  organisation: "",
  phone: "",
  email: "",
  notes: "",
  is_lead: false,
  send_invite: false,
};

export function CareTeamSection() {
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  const members = useLiveQuery(() => db.care_team.toArray(), []);
  const settings = useLiveQuery(() => db.settings.toArray(), []);

  const { membership } = useHousehold();
  const householdId = membership?.household_id ?? null;
  const isPrimary = membership?.role === "primary_carer";

  const [supaMembers, setSupaMembers] = useState<HouseholdMemberWithProfile[]>([]);
  const [supaInvites, setSupaInvites] = useState<HouseholdInvite[]>([]);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<DraftMember>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
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

  // Pull household members + invites whenever the household resolves.
  const reloadSupabase = useCallback(async () => {
    if (!householdId) {
      setSupaMembers([]);
      setSupaInvites([]);
      return;
    }
    const [m, inv] = await Promise.all([
      listHouseholdMembers(householdId),
      listInvites(householdId),
    ]);
    setSupaMembers(m);
    setSupaInvites(inv);
  }, [householdId]);
  useEffect(() => {
    void reloadSupabase();
  }, [reloadSupabase]);

  // Sync Supabase members → care_team. Any household account without a
  // matching care_team row gets one auto-created with role inferred from
  // the household role (clinician → oncologist sentinel, everything else →
  // family). Once present, we backfill account_user_id + account_status.
  useEffect(() => {
    if (members === undefined) return;
    void (async () => {
      for (const m of supaMembers) {
        const matched = await findCareTeamMemberForAccount({
          user_id: m.user_id,
          email: m.profile.display_name?.includes("@")
            ? m.profile.display_name
            : undefined,
        });
        if (matched?.id) {
          if (
            matched.account_user_id !== m.user_id ||
            matched.account_status !== "active" ||
            matched.pending_invite_id
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
            name: m.profile.display_name?.trim() || L("Family member", "家庭成员"),
            role: householdRoleToCareTeamRole(m.role),
            notes: m.profile.care_role_label?.trim() || undefined,
            account_user_id: m.user_id,
            account_status: "active",
          });
        }
      }
    })();
  }, [supaMembers, members]);

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

  // Pending invites that don't yet correspond to a care_team row appear as
  // ghost rows under "family" so the primary carer can revoke / re-copy.
  const orphanInvites = useMemo(() => {
    const pendingTokens = new Set(
      (members ?? [])
        .map((m) => m.pending_invite_token)
        .filter((t): t is string => Boolean(t)),
    );
    return supaInvites
      .filter(
        (i) =>
          !i.accepted_at &&
          !i.revoked_at &&
          new Date(i.expires_at) > new Date() &&
          !pendingTokens.has(i.token),
      );
  }, [supaInvites, members]);

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
      send_invite: false,
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

      // Step 1: persist the Dexie row first so the account-status badge
      // can latch onto it once the invite is created.
      let memberId: number;
      if (editing === "new") {
        memberId = await addCareTeamMember(payload);
      } else if (typeof editing === "number") {
        await updateCareTeamMember(editing, payload);
        memberId = editing;
      } else {
        cancel();
        return;
      }

      // Step 2: when "send Anchor invite" is ticked AND the user is the
      // primary carer AND we have a household, create the Supabase invite
      // and attach its token to the care_team row so the row renders as
      // "Pending acceptance" with a copy-link affordance.
      if (
        draft.send_invite &&
        isPrimary &&
        householdId &&
        draft.email.trim()
      ) {
        const inv = await createInvite({
          household_id: householdId,
          email_hint: draft.email.trim(),
          role: careTeamRoleToHouseholdRole(draft.role),
        });
        await updateCareTeamMember(memberId, {
          account_status: "invited",
          pending_invite_id: inv.id,
          pending_invite_token: inv.token,
        });
        await reloadSupabase();
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
          "Remove this person from the care team?",
          "从团队列表中移除此成员？",
        ),
      )
    ) {
      return;
    }
    const row = (members ?? []).find((m) => m.id === id);
    if (row?.pending_invite_id) {
      try {
        await revokeInvite(row.pending_invite_id);
        await reloadSupabase();
      } catch {
        // Non-fatal; the local row removal still proceeds.
      }
    }
    await removeCareTeamMember(id);
  }

  async function sendInviteFor(member: CareTeamMember) {
    if (!member.id || !householdId) return;
    if (!member.email?.trim()) {
      setError(
        L(
          "Add an email first so the invite has somewhere to land.",
          "请先填写邮箱,以便邀请有送达地址。",
        ),
      );
      return;
    }
    try {
      const inv = await createInvite({
        household_id: householdId,
        email_hint: member.email.trim(),
        role: careTeamRoleToHouseholdRole(member.role),
      });
      await updateCareTeamMember(member.id, {
        account_status: "invited",
        pending_invite_id: inv.id,
        pending_invite_token: inv.token,
      });
      await reloadSupabase();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function revokePending(member: CareTeamMember) {
    if (!member.id) return;
    if (member.pending_invite_id) {
      try {
        await revokeInvite(member.pending_invite_id);
      } catch {
        // ignore — local cleanup still useful
      }
    }
    await updateCareTeamMember(member.id, {
      account_status: "none",
      pending_invite_id: undefined,
      pending_invite_token: undefined,
    });
    await reloadSupabase();
  }

  async function copyInviteLink(token: string) {
    if (typeof window === "undefined") return;
    const url = inviteUrl(token, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="eyebrow">
            <Users className="mr-1.5 inline h-3.5 w-3.5" />
            {L("Care team", "护理团队")}
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            {L(
              "Family members, clinicians, and call-list contacts. Family members can be invited to their own Anchor account; everyone else lives in your local call list.",
              "家人、医师和紧急联系人。家人可邀请使用 Anchor 账号;其他人作为本地通讯录保留。",
            )}
          </p>
        </div>
        {editing === null && (
          <Button onClick={startAdd} size="md">
            <Plus className="h-4 w-4" />
            {L("Add", "新增")}
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
          canInvite={Boolean(isPrimary && householdId)}
        />
      )}

      {members !== undefined && members.length === 0 && editing === null && (
        <Card>
          <CardContent className="py-4 text-center text-[12.5px] text-ink-500">
            {L(
              "No one listed yet. Add yourself, the oncologist, and any family chaperones.",
              "还没有成员。先把自己、肿瘤科医师、家人陪同加进来。",
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {ROLES.map((role) => {
          const list = grouped.get(role) ?? [];
          const orphans = role === "family" ? orphanInvites : [];
          if (list.length === 0 && orphans.length === 0) return null;
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
                        <AccountStatusBadge status={m.account_status} locale={locale} />
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
                      {m.account_status === "invited" && m.pending_invite_token && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                          <button
                            type="button"
                            onClick={() => void copyInviteLink(m.pending_invite_token!)}
                            className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-700 hover:bg-ink-100/40"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedToken === m.pending_invite_token
                              ? L("Copied", "已复制")
                              : L("Copy invite link", "复制邀请链接")}
                          </button>
                          <button
                            type="button"
                            onClick={() => void revokePending(m)}
                            className="text-ink-500 hover:text-[var(--warn)]"
                          >
                            {L("Cancel invite", "撤销邀请")}
                          </button>
                        </div>
                      )}
                      {m.account_status !== "invited" &&
                        m.account_status !== "active" &&
                        m.role === "family" &&
                        isPrimary &&
                        householdId &&
                        m.email && (
                          <div className="mt-1.5">
                            <button
                              type="button"
                              onClick={() => void sendInviteFor(m)}
                              className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-700 hover:bg-ink-100/40"
                            >
                              <Mail className="h-3 w-3" />
                              {L("Send Anchor invite", "发送 Anchor 邀请")}
                            </button>
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
                        className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100/40 hover:text-red-700"
                        aria-label={L("Remove", "移除")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
                {orphans.map((inv) => (
                  <li
                    key={`inv-${inv.id}`}
                    className="flex items-start gap-3 px-3 py-2.5 text-[13px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-ink-900">
                          {inv.email_hint || L("(unknown)", "(未填写)")}
                        </span>
                        <AccountStatusBadge status="invited" locale={locale} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                        <button
                          type="button"
                          onClick={() => void copyInviteLink(inv.token)}
                          className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-700 hover:bg-ink-100/40"
                        >
                          <Copy className="h-3 w-3" />
                          {copiedToken === inv.token
                            ? L("Copied", "已复制")
                            : L("Copy invite link", "复制邀请链接")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void revokeInvite(inv.id).then(() => reloadSupabase())
                          }
                          className="text-ink-500 hover:text-[var(--warn)]"
                        >
                          {L("Revoke", "撤销")}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AccountStatusBadge({
  status,
  locale,
}: {
  status: CareTeamMember["account_status"];
  locale: "en" | "zh";
}) {
  if (!status || status === "none") return null;
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  if (status === "invited") {
    return (
      <span className="rounded-full bg-[var(--sand)] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em] text-ink-900">
        {L("Pending acceptance", "待接受")}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[var(--ok-soft)] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em] text-[var(--ok)]">
      {L("Anchor account", "Anchor 账号")}
    </span>
  );
}

function DraftEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  locale,
  canInvite,
}: {
  draft: DraftMember;
  onChange: (d: DraftMember) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  locale: "en" | "zh";
  canInvite: boolean;
}) {
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const isFamily = draft.role === "family";
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

        {isFamily && draft.id === undefined && canInvite && (
          <label className="flex items-start gap-2 rounded-md border border-ink-100 bg-paper-2 p-2.5 text-[12.5px] text-ink-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={draft.send_invite}
              onChange={(e) =>
                onChange({ ...draft, send_invite: e.target.checked })
              }
            />
            <span>
              <span className="block font-medium text-ink-900">
                {L(
                  "Also send an Anchor invite link",
                  "同时生成 Anchor 邀请链接",
                )}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-ink-500">
                {L(
                  "Creates a one-use sign-up link you can share. Email above is used as the hint.",
                  "生成一次性注册链接,您可分享。以上邮箱作为提示。",
                )}
              </span>
            </span>
          </label>
        )}

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

function householdRoleToCareTeamRole(role: HouseholdRole): CareTeamRole {
  switch (role) {
    case "patient":
    case "family":
    case "primary_carer":
    case "observer":
      return "family";
    case "clinician":
      return "other";
  }
}

function careTeamRoleToHouseholdRole(role: CareTeamRole): HouseholdRole {
  switch (role) {
    case "family":
      return "family";
    case "oncologist":
    case "surgeon":
    case "gp":
    case "nurse":
    case "allied_health":
      return "clinician";
    case "other":
      return "observer";
  }
}
