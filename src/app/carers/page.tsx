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
import { LocalContactsSection } from "~/components/invite/local-contacts-section";
import {
  UserPlus,
  Loader2,
  Lock,
  ChevronRight,
  CalendarClock,
} from "lucide-react";

// /carers — single source of truth for everyone involved in the
// patient's care. See the README at the bottom of this file for the
// design rationale.
//
// Page layout (top → bottom):
//   1. Top section — depends on auth/household state. Renders the
//      "Add carer" CTA + Anchor membership list when signed in with
//      a household; falls back to a "Sign in" or "Set up household"
//      prompt otherwise. NEVER blocks the page on a global loading
//      spinner — useHousehold has its own 4s safety timeout, and
//      this page renders the local-contacts directory regardless.
//   2. Local contacts — always rendered. It's pure Dexie / offline
//      and has no dependency on Supabase, so if the cloud is
//      unreachable the user can still read the oncologist's phone
//      number and call.
//   3. Footer link → /care-team (visit log).

export default function CarersPage() {
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

  const activeInvites = invites.filter(
    (i) => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date(),
  );

  const supabaseConfigured = isSupabaseConfigured();

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={L("CARERS", "护理人员")}
        title={
          household
            ? L(
                `${household.patient_display_name}'s care team`,
                `${household.patient_display_name} 的护理团队`,
              )
            : L("Carers", "护理人员")
        }
        subtitle={
          household && members.length > 0 ? (
            <span className="text-[12px] text-ink-500">
              {L(
                `${members.length} ${members.length === 1 ? "carer" : "carers"} on Anchor`,
                `${members.length} 位 Anchor 账号成员`,
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
            </span>
          ) : undefined
        }
      />

      {/* TOP: Anchor-account section. Renders one of:
          - "Add carer" CTA + members list (signed in + has household)
          - read-only members hint (signed in but not primary_carer)
          - "Sign in" prompt (signed out)
          - "Set up household" prompt (signed in, no household)
          - "Sync isn't configured" notice (offline-only build)
          - Inline loading hint (still resolving)
          The local contacts section below is unaffected by any of
          these states. */}
      {!supabaseConfigured ? (
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
                "Anchor account invites need cloud sync. The local contact directory below still works fully offline.",
                "邀请 Anchor 账号需启用云同步。下方本地通讯录可在离线状态下使用。",
              )}
            </p>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="flex items-center gap-2 pt-5 text-[12.5px] text-ink-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {L("Checking your account…", "正在检查账号…")}
          </CardContent>
        </Card>
      ) : !profile ? (
        <Card>
          <CardContent className="space-y-3 pt-5 text-[13px] text-ink-500">
            <p>
              {L(
                "Sign in to see and add carers.",
                "登录后即可查看与添加护理人员。",
              )}
            </p>
            <Link href="/login?next=%2Fcarers">
              <Button size="md">{L("Sign in", "登录")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : !membership || !householdId ? (
        <Card>
          <CardContent className="space-y-3 pt-5 text-[13px] text-ink-500">
            <p>
              {L(
                "You aren't part of a household yet. Run through onboarding to create one — then you can add carers from here.",
                "您尚未加入家庭。请完成引导流程创建家庭，再从此页添加护理人员。",
              )}
            </p>
            <Link href="/onboarding">
              <Button size="md">
                {L("Set up household", "创建家庭")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Primary CTA — the answer to "no obvious way to add carers". */}
          {isPrimary && !showInviteFlow && (
            <Card className="border-[var(--tide-2)]/40 bg-[var(--tide-soft)]">
              <CardContent className="flex items-center justify-between gap-3 pt-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--tide-2)]/15 text-[var(--tide-2)]">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-ink-900">
                      {L("Add a carer", "添加护理人员")}
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-ink-500">
                      {L(
                        "Send an invite link — family member, clinician, or observer.",
                        "发送邀请链接 —— 家人、医师或观察者均可。",
                      )}
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowInviteFlow(true)} size="md">
                  {L("Add carer", "添加")}
                </Button>
              </CardContent>
            </Card>
          )}

          {!isPrimary && (
            <Card>
              <CardContent className="flex items-start gap-2 pt-4 text-[12.5px] text-ink-500">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {L(
                    "Only the primary carer can add or remove carers. Ask them if you'd like to bring someone in.",
                    "仅主要照护者可添加或移除护理人员。如需新增，请联系主要照护者。",
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
            <SectionHeader title={L("On Anchor", "Anchor 账号")} />
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
        </>
      )}

      {/* Local contacts ALWAYS renders — pure offline / Dexie. The
          phone book is the most important fallback when sync is
          flaky: tired carer needs to call the oncologist, opens
          /carers, gets the number. Don't gate it behind anything. */}
      <section className="space-y-2">
        <SectionHeader title={L("Local contacts", "本地通讯录")} />
        <LocalContactsSection />
      </section>

      <section className="pt-2">
        <Link
          href="/care-team"
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900"
        >
          <CalendarClock className="h-3.5 w-3.5" />
          {L("View clinical contact log", "查看就诊 / 通话记录")}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </section>
    </div>
  );
}
