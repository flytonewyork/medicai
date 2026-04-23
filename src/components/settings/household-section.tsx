"use client";

import { useCallback, useEffect, useState } from "react";
import { useHousehold } from "~/hooks/use-household";
import {
  createInvite,
  getHousehold,
  inviteUrl,
  leaveHousehold,
  listHouseholdMembers,
  listInvites,
  removeMember,
  revokeInvite,
  updateMyProfile,
} from "~/lib/supabase/households";
import type {
  Household,
  HouseholdInvite,
  HouseholdMemberWithProfile,
  HouseholdRole,
} from "~/types/household";
import { Field, TextInput } from "~/components/ui/field";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Users,
  Star,
  UserPlus,
  Copy,
  CheckCircle2,
  Trash2,
  LogOut,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

const ROLE_LABEL: Record<HouseholdRole, string> = {
  primary_carer: "Primary carer",
  patient: "Patient",
  family: "Family",
  clinician: "Clinician",
  observer: "Observer",
};

const ROLE_TONE: Record<HouseholdRole, string> = {
  primary_carer: "bg-[var(--tide-soft)] text-[var(--tide-2)]",
  patient: "bg-[var(--tide)]/20 text-[var(--tide-2)]",
  family: "bg-ink-100 text-ink-700",
  clinician: "bg-[var(--sand)] text-ink-900",
  observer: "bg-paper-2 text-ink-500",
};

export function HouseholdSection() {
  const { membership, profile, loading, refresh } = useHousehold();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMemberWithProfile[]>([]);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);

  const householdId = membership?.household_id ?? null;
  const isPrimary = membership?.role === "primary_carer";

  const loadAll = useCallback(async () => {
    if (!householdId) {
      setHousehold(null);
      setMembers([]);
      setInvites([]);
      return;
    }
    const [h, ms, inv] = await Promise.all([
      getHousehold(householdId),
      listHouseholdMembers(householdId),
      listInvites(householdId),
    ]);
    setHousehold(h);
    setMembers(ms);
    setInvites(inv);
  }, [householdId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="eyebrow">
          <Users className="mr-1.5 inline h-3.5 w-3.5" />
          Family
        </h2>
        <p className="text-[12px] text-ink-500">Loading&hellip;</p>
      </section>
    );
  }

  if (!membership) {
    return (
      <section className="space-y-3">
        <h2 className="eyebrow">
          <Users className="mr-1.5 inline h-3.5 w-3.5" />
          Family
        </h2>
        <Card>
          <CardContent className="py-4 text-[12.5px] text-ink-500">
            You aren&rsquo;t part of a family yet. Sign in and either
            create one from the dashboard or accept an invite link.
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="eyebrow">
          <Users className="mr-1.5 inline h-3.5 w-3.5" />
          Family
        </h2>
        {household && (
          <p className="mt-1 text-xs text-ink-500">
            {household.name} &middot; caring for{" "}
            <span className="text-ink-700">
              {household.patient_display_name}
            </span>
          </p>
        )}
      </div>

      <MyProfileCard
        profileName={profile?.display_name ?? ""}
        careLabel={profile?.care_role_label ?? ""}
        onSaved={refresh}
      />

      <MembersList
        members={members}
        currentUserId={profile?.id ?? null}
        isPrimary={isPrimary}
        onRemove={async (uid) => {
          if (!householdId) return;
          if (
            !window.confirm(
              "Remove this person from the family? They'll keep their account.",
            )
          )
            return;
          await removeMember({ household_id: householdId, user_id: uid });
          await loadAll();
        }}
      />

      {isPrimary && householdId && (
        <InvitePanel
          householdId={householdId}
          invites={invites}
          onCreated={loadAll}
          onRevoke={async (id) => {
            await revokeInvite(id);
            await loadAll();
          }}
        />
      )}

      {!isPrimary && householdId && (
        <LeaveButton
          onLeave={async () => {
            if (
              !window.confirm(
                "Leave this family? You'll stop seeing their data.",
              )
            )
              return;
            await leaveHousehold(householdId);
            await refresh();
          }}
        />
      )}
    </section>
  );
}

function MyProfileCard({
  profileName,
  careLabel,
  onSaved,
}: {
  profileName: string;
  careLabel: string;
  onSaved: () => Promise<void>;
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
          Your profile
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Display name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Role label (optional)">
            <TextInput
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Son, Wife, Palliative RN"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty || saving} size="md">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MembersList({
  members,
  currentUserId,
  isPrimary,
  onRemove,
}: {
  members: HouseholdMemberWithProfile[];
  currentUserId: string | null;
  isPrimary: boolean;
  onRemove: (uid: string) => Promise<void>;
}) {
  if (members.length === 0) return null;
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-400">
          Members
        </div>
        <ul className="divide-y divide-ink-100">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13.5px] font-medium text-ink-900">
                    {m.profile.display_name || "—"}
                  </span>
                  {m.user_id === currentUserId && (
                    <span className="mono text-[10px] text-ink-400">
                      YOU
                    </span>
                  )}
                  {m.role === "primary_carer" && (
                    <Star
                      className="h-3 w-3 fill-[var(--tide-2)] text-[var(--tide-2)]"
                      aria-label="Primary carer"
                    />
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-500">
                  {m.profile.care_role_label && (
                    <span>{m.profile.care_role_label}</span>
                  )}
                  {m.profile.care_role_label && " · "}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em]",
                      ROLE_TONE[m.role],
                    )}
                  >
                    {ROLE_LABEL[m.role]}
                  </span>
                </div>
              </div>
              {isPrimary && m.user_id !== currentUserId && (
                <button
                  type="button"
                  onClick={() => void onRemove(m.user_id)}
                  className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100/40 hover:text-red-700"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function InvitePanel({
  householdId,
  invites,
  onCreated,
  onRevoke,
}: {
  householdId: string;
  invites: HouseholdInvite[];
  onCreated: () => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<HouseholdRole>("family");
  const [creating, setCreating] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function send() {
    setCreating(true);
    try {
      const inv = await createInvite({
        household_id: householdId,
        email_hint: email.trim() || undefined,
        role,
      });
      const url = inviteUrl(
        inv.token,
        typeof window !== "undefined" ? window.location.origin : "",
      );
      setLastUrl(url);
      setEmail("");
      await onCreated();
    } finally {
      setCreating(false);
    }
  }

  async function copy() {
    if (!lastUrl) return;
    try {
      await navigator.clipboard.writeText(lastUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  const pending = invites.filter(
    (i) => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date(),
  );

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-400">
          Invite a family member or clinician
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Email (optional hint)">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="catherine@example.com"
            />
          </Field>
          <div>
            <div className="mb-1 text-sm font-medium text-ink-800">Role</div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as HouseholdRole)}
              className="h-11 rounded-lg border border-ink-200 bg-paper-2 px-3 text-sm"
            >
              <option value="family">Family</option>
              <option value="patient">Patient</option>
              <option value="primary_carer">Primary carer</option>
              <option value="clinician">Clinician</option>
              <option value="observer">Observer</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-500">
            Generates a one-use link. Share it by email, iMessage, or
            anywhere else. Expires in 14 days.
          </p>
          <Button onClick={send} disabled={creating} size="md">
            <UserPlus className="h-4 w-4" />
            {creating ? "Creating…" : "Create link"}
          </Button>
        </div>

        {lastUrl && (
          <div className="rounded-md border border-[var(--tide-2)]/40 bg-[var(--tide-soft)]/40 p-3 text-[12.5px]">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-ink-900">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--tide-2)]" />
              Invite ready
            </div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-paper-2 px-2 py-1 text-[11px] text-ink-700">
                {lastUrl}
              </code>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-700 hover:bg-ink-100/40"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {pending.length > 0 && (
          <div className="space-y-1.5 border-t border-ink-100 pt-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-400">
              Pending invites ({pending.length})
            </div>
            <ul className="space-y-1">
              {pending.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-2 text-[12px]"
                >
                  <div className="min-w-0 flex-1 truncate">
                    <span className="text-ink-700">
                      {inv.email_hint ?? "(no email hint)"}
                    </span>{" "}
                    &middot;{" "}
                    <span className="text-ink-500">{ROLE_LABEL[inv.role]}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onRevoke(inv.id)}
                    className="text-ink-500 hover:text-red-700"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeaveButton({ onLeave }: { onLeave: () => Promise<void> }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => void onLeave()}
        className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-3 py-2 text-[12px] text-ink-600 hover:border-[var(--warn)] hover:text-[var(--warn)]"
      >
        <LogOut className="h-3.5 w-3.5" />
        Leave family
      </button>
    </div>
  );
}
