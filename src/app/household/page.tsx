"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useHousehold } from "~/hooks/use-household";
import {
  getHousehold,
  listHouseholdMembers,
  listInvites,
} from "~/lib/supabase/households";
import type {
  Household,
  HouseholdInvite,
  HouseholdMemberWithProfile,
} from "~/types/household";
import { useLocale } from "~/hooks/use-translate";
import { isSupabaseConfigured } from "~/lib/supabase/client";
import { PageHeader, SectionHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { InviteCarerFlow } from "~/components/invite/invite-carer-flow";
import { MembersList } from "~/components/invite/members-list";
import { PendingInvitesList } from "~/components/invite/pending-invites-list";
import {
  UserPlus,
  Loader2,
  Lock,
  ExternalLink,
} from "lucide-react";

// /household — primary carer's home for everything to do with WHO is on
// the care team in Anchor. Distinct from /care-team (which is the
// patient's external clinical contacts log) so the two concepts don't
// conflate. Read-only view for non-primary members; primary_carer gets
// the issuance flow + role + remove affordances.
//
// Why a dedicated page?
// - Invites buried in /settings#care-team are coupled to the local
//   call-list and harder to find for a tired carer.
// - The flow is conceptually a sub-feature of "manage the family", not a
//   one-time setting tweak. It deserves its own URL.
// - It's where the primary carer goes when an invite was accepted, when
//   a new clinician joins, when someone needs to be removed.
export default function HouseholdPage() {
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const { membership, profile, loading } = useHousehold();
  const householdId = membership?.household_id ?? null;
  const isPrimary = membership?.role === "primary_carer";

  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMemberWithProfile[]>([]);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
  const [showInviteFlow, setShowInviteFlow] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const reload = useCallback(async () => {
    if (!householdId) {
      setHousehold(null);
      setMembers([]);
      setInvites([]);
      return;
    }
    setLoadingData(true);
    try {
      const [h, m, inv] = await Promise.all([
        getHousehold(householdId),
        listHouseholdMembers(householdId),
        listInvites(householdId),
      ]);
      setHousehold(h);
      setMembers(m);
      setInvites(inv);
    } finally {
      setLoadingData(false);
    }
  }, [householdId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
        <PageHeader
          eyebrow={L("HOUSEHOLD", "家庭")}
          title={L("Care team members", "护理团队成员")}
        />
        <Card>
          <CardContent className="space-y-2 pt-5 text-[13px] text-ink-500">
            <div className="flex items-center gap-2 text-ink-700">
              <Lock className="h-4 w-4" />
              <span className="font-medium">
                {L("Sync isn't configured", "尚未配置同步")}
              </span>
            </div>
            <p>
              {L(
                "Inviting family requires the cloud sync to be set up. Anchor still works fully offline on this device.",
                "邀请家人需启用云同步。本设备的 Anchor 在离线模式下仍可使用。",
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
        <PageHeader
          eyebrow={L("HOUSEHOLD", "家庭")}
          title={L("Care team members", "护理团队成员")}
        />
        <Card>
          <CardContent className="flex items-center gap-2 pt-5 text-[13px] text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {L("Loading household…", "加载中…")}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
        <PageHeader
          eyebrow={L("HOUSEHOLD", "家庭")}
          title={L("Care team members", "护理团队成员")}
        />
        <Card>
          <CardContent className="space-y-3 pt-5 text-[13px] text-ink-500">
            <p>
              {L(
                "Sign in to see who's on the care team.",
                "登录后即可查看护理团队成员。",
              )}
            </p>
            <Link href="/login?next=%2Fhousehold">
              <Button size="md">{L("Sign in", "登录")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!membership || !householdId) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
        <PageHeader
          eyebrow={L("HOUSEHOLD", "家庭")}
          title={L("Care team members", "护理团队成员")}
        />
        <Card>
          <CardContent className="space-y-3 pt-5 text-[13px] text-ink-500">
            <p>
              {L(
                "You aren't part of a household yet. Run through onboarding to create one, or accept an invite link if someone sent you one.",
                "您尚未加入任何家庭。请完成引导流程创建家庭，或接受他人发来的邀请链接。",
              )}
            </p>
            <div className="flex gap-2">
              <Link href="/onboarding">
                <Button size="md">
                  {L("Set up household", "创建家庭")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeInvites = invites.filter(
    (i) => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date(),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={L("HOUSEHOLD", "家庭")}
        title={
          household
            ? L(
                `${household.patient_display_name}'s care team`,
                `${household.patient_display_name} 的护理团队`,
              )
            : L("Care team members", "护理团队成员")
        }
      />

      {household && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 pt-4">
            <div>
              <div className="text-[13px] font-semibold text-ink-900">
                {household.name}
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink-500">
                {L(
                  `${members.length} ${members.length === 1 ? "member" : "members"}`,
                  `${members.length} 位成员`,
                )}
                {activeInvites.length > 0 && (
                  <>
                    {" · "}
                    {L(
                      `${activeInvites.length} pending`,
                      `${activeInvites.length} 份待接受`,
                    )}
                  </>
                )}
              </div>
            </div>
            {isPrimary && !showInviteFlow && (
              <Button onClick={() => setShowInviteFlow(true)} size="md">
                <UserPlus className="h-4 w-4" />
                {L("Invite", "邀请")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!isPrimary && (
        <Card>
          <CardContent className="flex items-start gap-2 pt-4 text-[12.5px] text-ink-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {L(
                "Only the primary carer can invite, change roles, or remove members. Ask them if you'd like to add someone.",
                "仅主要照护者可邀请、修改角色或移除成员。如需新增成员，请联系主要照护者。",
              )}
            </span>
          </CardContent>
        </Card>
      )}

      {isPrimary && showInviteFlow && (
        <InviteCarerFlow
          householdId={householdId}
          onClose={() => setShowInviteFlow(false)}
          onIssued={() => void reload()}
        />
      )}

      <section className="space-y-2">
        <SectionHeader title={L("Members", "成员")} />
        {loadingData && members.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-2 pt-5 text-[13px] text-ink-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {L("Loading members…", "加载成员中…")}
            </CardContent>
          </Card>
        ) : (
          <MembersList
            members={members}
            currentUserId={profile.id}
            isPrimary={Boolean(isPrimary)}
            householdId={householdId}
            onChanged={reload}
          />
        )}
      </section>

      {isPrimary && invites.length > 0 && (
        <section className="space-y-2">
          <SectionHeader title={L("Invites", "邀请")} />
          <PendingInvitesList invites={invites} onChanged={reload} />
        </section>
      )}

      <section className="pt-2">
        <Link
          href="/care-team"
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900"
        >
          <ExternalLink className="h-3 w-3" />
          {L(
            "Looking for the external clinical contacts log? It's at /care-team.",
            "查找外部临床联系人记录？前往 /care-team。",
          )}
        </Link>
      </section>
    </div>
  );
}
