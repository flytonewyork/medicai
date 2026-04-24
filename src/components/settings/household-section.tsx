"use client";

import { useEffect, useState } from "react";
import { useHousehold } from "~/hooks/use-household";
import {
  getHousehold,
  leaveHousehold,
  updateMyProfile,
} from "~/lib/supabase/households";
import type { Household } from "~/types/household";
import { Field, TextInput } from "~/components/ui/field";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Users, LogOut } from "lucide-react";

// Slim "My household" card — covers the personal slice of the original
// HouseholdSection (your display name + role label + leave button) and
// leaves member / invite management to the unified CareTeamSection.

export function HouseholdSection() {
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

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="eyebrow">
          <Users className="mr-1.5 inline h-3.5 w-3.5" />
          Household
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
          Household
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
          Household
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
