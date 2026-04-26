"use client";

import { useState } from "react";
import {
  removeMember,
  updateMemberRole,
  friendlyInviteError,
} from "~/lib/supabase/households";
import { ROLE_LABEL } from "~/lib/auth/permissions";
import type {
  HouseholdMemberWithProfile,
  HouseholdRole,
} from "~/types/household";
import { useLocale } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import {
  Crown,
  Stethoscope,
  Users as UsersIcon,
  Eye,
  User as UserIcon,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

const ROLE_ICON: Record<HouseholdRole, React.ComponentType<{ className?: string }>> = {
  primary_carer: Crown,
  patient: UserIcon,
  family: UsersIcon,
  clinician: Stethoscope,
  observer: Eye,
};

interface Props {
  members: HouseholdMemberWithProfile[];
  currentUserId: string | null;
  isPrimary: boolean;
  householdId: string;
  onChanged?: () => void;
}

export function MembersList({
  members,
  currentUserId,
  isPrimary,
  householdId,
  onChanged,
}: Props) {
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Render the primary_carer first, then patient, then everyone else
  // alphabetically — so the household admin and patient stay top-of-list
  // even as the team grows.
  const sorted = [...members].sort((a, b) => {
    const order: Record<HouseholdRole, number> = {
      primary_carer: 0,
      patient: 1,
      family: 2,
      clinician: 3,
      observer: 4,
    };
    if (a.role !== b.role) return order[a.role] - order[b.role];
    return (a.profile.display_name || "").localeCompare(
      b.profile.display_name || "",
    );
  });

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-4 text-center text-[12.5px] text-ink-500">
          {L(
            "No one's joined yet. Send the first invite below.",
            "暂无成员。请在下方发送第一份邀请。",
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[var(--warn)]/40 bg-[var(--warn-soft)] p-2.5 text-[12px] text-[var(--warn)]"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <ul className="divide-y divide-ink-100 rounded-md border border-ink-100 bg-paper">
        {sorted.map((m) => (
          <MemberRow
            key={m.user_id}
            member={m}
            isSelf={m.user_id === currentUserId}
            isPrimary={isPrimary}
            householdId={householdId}
            isEditing={editing === m.user_id}
            onStartEdit={() => {
              setEditing(m.user_id);
              setError(null);
            }}
            onCancelEdit={() => setEditing(null)}
            onChanged={async () => {
              setEditing(null);
              await onChanged?.();
            }}
            onError={setError}
            locale={locale}
          />
        ))}
      </ul>
    </div>
  );
}

function MemberRow({
  member,
  isSelf,
  isPrimary,
  householdId,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onChanged,
  onError,
  locale,
}: {
  member: HouseholdMemberWithProfile;
  isSelf: boolean;
  isPrimary: boolean;
  householdId: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
  locale: "en" | "zh";
}) {
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const Icon = ROLE_ICON[member.role];
  const [saving, setSaving] = useState(false);
  const [pendingRole, setPendingRole] = useState<HouseholdRole>(member.role);

  // Self-edit + remove are forbidden via the server too, but we hide
  // the affordances here so the carer doesn't accidentally lock
  // themselves out of their own household.
  const canManage = isPrimary && !isSelf;

  async function saveRole() {
    if (pendingRole === member.role) {
      onCancelEdit();
      return;
    }
    setSaving(true);
    try {
      await updateMemberRole({
        household_id: householdId,
        user_id: member.user_id,
        new_role: pendingRole,
      });
      await onChanged();
    } catch (err) {
      onError(friendlyInviteError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        L(
          `Remove ${member.profile.display_name || "this member"} from the household? They'll lose access immediately.`,
          `从家庭中移除 ${member.profile.display_name || "该成员"}？对方将立即失去访问权限。`,
        ),
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await removeMember({
        household_id: householdId,
        user_id: member.user_id,
      });
      await onChanged();
    } catch (err) {
      onError(friendlyInviteError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex items-start gap-3 px-3 py-3 text-[13px]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-700">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink-900">
            {member.profile.display_name?.trim() ||
              L("Unnamed member", "未命名成员")}
          </span>
          {isSelf && (
            <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-400">
              {L("you", "你")}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-500">
          {!isEditing && (
            <span className="rounded-full bg-paper-2 px-2 py-0.5 font-medium text-ink-700">
              {ROLE_LABEL[member.role][locale]}
            </span>
          )}
          {member.profile.relationship && (
            <span>· {member.profile.relationship}</span>
          )}
          {member.profile.timezone && (
            <span className="mono">· {member.profile.timezone}</span>
          )}
        </div>

        {isEditing && (
          <div className="mt-2 space-y-2">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-400">
              {L("Change role", "修改角色")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  "primary_carer",
                  "patient",
                  "family",
                  "clinician",
                  "observer",
                ] as HouseholdRole[]
              ).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setPendingRole(r)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
                    pendingRole === r
                      ? "border-ink-900 bg-ink-900 text-paper"
                      : "border-ink-200 bg-paper-2 text-ink-700 hover:border-ink-400",
                  )}
                >
                  {ROLE_LABEL[r][locale]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void saveRole()}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md bg-ink-900 px-3 py-1.5 text-[12px] font-medium text-paper hover:bg-ink-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {L("Save", "保存")}
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                disabled={saving}
                className="text-[12px] text-ink-500 hover:text-ink-900"
              >
                {L("Cancel", "取消")}
              </button>
            </div>
          </div>
        )}
      </div>
      {canManage && !isEditing && (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onStartEdit}
            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100/40 hover:text-ink-900"
            aria-label={L("Edit role", "编辑角色")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={saving}
            className="rounded-md p-1.5 text-ink-500 hover:bg-[var(--warn-soft)] hover:text-[var(--warn)] disabled:opacity-50"
            aria-label={L("Remove member", "移除成员")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}
