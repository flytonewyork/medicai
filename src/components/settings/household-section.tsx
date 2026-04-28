"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHousehold } from "~/hooks/use-household";
import { useL } from "~/hooks/use-translate";
import { isSupabaseConfigured } from "~/lib/supabase/client";
import {
  getHousehold,
  leaveHousehold,
  updateMyProfile,
} from "~/lib/supabase/households";
import type { Household } from "~/types/household";
import { Field, TextInput } from "~/components/ui/field";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Loader2, Lock, LogOut, UserPlus, Users } from "lucide-react";

// Slim "My household" card. Renders a different state for each of the
// five real situations a user can be in:
//
//   - Supabase isn't configured → offline-only build, no point in
//     pretending invites are an option here. (No CTA.)
//   - useHousehold still resolving → loading hint.
//   - Signed out → "Sign in to share Anchor with carers." → /login.
//   - Signed in but no household → "Set up your care team in one tap." →
//     /carers?action=add-carer. The /carers page handles the bootstrap
//     + invite flow. We do NOT route to /onboarding (it dead-ends on
//     `settings.onboarded_at`).
//   - Signed in + member → personal display-name + role-label form,
//     plus a leave button for everyone except the primary carer.
//
// Earlier versions collapsed the first three states into a single
// "you aren't part of a family yet" nag that fired regardless of
// auth state and pointed users at a non-existent dashboard widget.

export function HouseholdSection() {
  const L = useL();
  const { membership, profile, loading, refresh } = useHousehold();
  const [household, setHousehold] = useState<Household | null>(null);
  const householdId = membership?.household_id ?? null;
  const isPrimary = membership?.role === "primary_carer";

  useEffect(() => {
    if (!householdId) {
      setHousehold(null);
      return;
    }
    void getHousehold(householdId).then(setHousehold);
  }, [householdId]);

  return (
    <section className="space-y-3">
      <Heading L={L} />
      <Body
        L={L}
        configured={isSupabaseConfigured()}
        loading={loading}
        signedIn={!!profile}
        membership={membership}
        household={household}
        householdId={householdId}
        isPrimary={!!isPrimary}
        profileName={profile?.display_name ?? ""}
        careLabel={profile?.care_role_label ?? ""}
        refresh={refresh}
      />
    </section>
  );
}

function Heading({ L }: { L: (en: string, zh: string) => string }) {
  return (
    <h2 className="eyebrow">
      <Users className="mr-1.5 inline h-3.5 w-3.5" />
      {L("Household", "家庭")}
    </h2>
  );
}

interface BodyProps {
  L: (en: string, zh: string) => string;
  configured: boolean;
  loading: boolean;
  signedIn: boolean;
  membership: ReturnType<typeof useHousehold>["membership"];
  household: Household | null;
  householdId: string | null;
  isPrimary: boolean;
  profileName: string;
  careLabel: string;
  refresh: () => Promise<void>;
}

function Body({
  L,
  configured,
  loading,
  signedIn,
  membership,
  household,
  householdId,
  isPrimary,
  profileName,
  careLabel,
  refresh,
}: BodyProps) {
  // Order matters. "Not configured" wins over every other state because
  // there's literally no cloud to sign into.
  if (!configured) {
    return (
      <Card>
        <CardContent className="space-y-2 pt-4 text-[12.5px] text-ink-500">
          <div className="flex items-center gap-2 text-ink-700">
            <Lock className="h-3.5 w-3.5" />
            <span className="font-medium">
              {L("Sync isn't on for this build", "本版本未启用同步")}
            </span>
          </div>
          <p>
            {L(
              "Anchor account features (sharing with carers, accepting invite links) need cloud sync. Local check-ins keep working without it.",
              "邀请家人、接受邀请链接等账号功能需启用云同步。本地记录仍可离线使用。",
            )}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 pt-4 text-[12.5px] text-ink-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {L("Checking your account…", "正在检查账号…")}
        </CardContent>
      </Card>
    );
  }

  if (!signedIn) {
    return (
      <Card className="border-[var(--tide-2)]/40 bg-[var(--tide-soft)]">
        <CardContent className="space-y-3 pt-4 text-[13px]">
          <div className="flex items-center gap-2 text-ink-900">
            <UserPlus className="h-4 w-4 text-[var(--tide-2)]" />
            <span className="font-semibold">
              {L("Sign in to share Anchor with carers", "登录后即可与家人共享 Anchor")}
            </span>
          </div>
          <p className="text-ink-700">
            {L(
              "An account lets you create your care team and invite family. The data on this device stays where it is until you sign in.",
              "登录后即可创建护理团队并邀请家人。本设备数据在您登录前会保留在本地。",
            )}
          </p>
          <Link href="/login?next=%2Fsettings">
            <Button size="md">{L("Sign in", "登录")}</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!membership || !householdId) {
    return (
      <Card className="border-[var(--tide-2)]/40 bg-[var(--tide-soft)]">
        <CardContent className="space-y-3 pt-4 text-[13px]">
          <div className="flex items-center gap-2 text-ink-900">
            <UserPlus className="h-4 w-4 text-[var(--tide-2)]" />
            <span className="font-semibold">
              {L("Set up your care team", "创建您的护理团队")}
            </span>
          </div>
          <p className="text-ink-700">
            {L(
              "One tap creates your care team and lets you start sharing it with carers. If someone has invited you, open their invite link instead.",
              "轻触一下即可创建护理团队并开始邀请家人。如已收到邀请链接，请直接打开链接。",
            )}
          </p>
          <Link href="/carers?action=add-carer">
            <Button size="md">
              {L("Set up & invite a carer", "创建并邀请护理人员")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {household && (
        <p className="-mt-1 text-xs text-ink-500">
          {L(
            `${household.name} · caring for ${household.patient_display_name}`,
            `${household.name} · 照护 ${household.patient_display_name}`,
          )}
        </p>
      )}
      <MyProfileCard
        profileName={profileName}
        careLabel={careLabel}
        onSaved={refresh}
        L={L}
      />
      {!isPrimary && (
        <LeaveButton
          L={L}
          onLeave={async () => {
            if (
              !window.confirm(
                L(
                  "Leave this family? You'll stop seeing their data.",
                  "确定要离开此家庭？将无法继续查看其数据。",
                ),
              )
            )
              return;
            await leaveHousehold(householdId);
            await refresh();
          }}
        />
      )}
    </>
  );
}

function MyProfileCard({
  profileName,
  careLabel,
  onSaved,
  L,
}: {
  profileName: string;
  careLabel: string;
  onSaved: () => Promise<void>;
  L: (en: string, zh: string) => string;
}) {
  const [name, setName] = useState(profileName);
  const [label, setLabel] = useState(careLabel);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profileName);
    setLabel(careLabel);
  }, [profileName, careLabel]);

  const dirty = name !== profileName || label !== careLabel;

  async function save() {
    setSaving(true);
    try {
      await updateMyProfile({
        display_name: name.trim() || profileName,
        care_role_label: label.trim() || null,
      });
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-400">
          {L("Your profile", "您的资料")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={L("Display name", "显示名称")}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={L("Role label (optional)", "角色标签（可选）")}>
            <TextInput
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={L(
                "e.g. Son, Wife, Palliative RN",
                "例如：儿子、妻子、姑息护理护士",
              )}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty || saving} size="md">
            {saving ? L("Saving…", "保存中…") : L("Save", "保存")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LeaveButton({
  L,
  onLeave,
}: {
  L: (en: string, zh: string) => string;
  onLeave: () => Promise<void>;
}) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => void onLeave()}
        className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-3 py-2 text-[12px] text-ink-600 hover:border-[var(--warn)] hover:text-[var(--warn)]"
      >
        <LogOut className="h-3.5 w-3.5" />
        {L("Leave family", "离开家庭")}
      </button>
    </div>
  );
}
