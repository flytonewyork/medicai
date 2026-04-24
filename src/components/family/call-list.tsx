"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { useBilingual } from "~/hooks/use-bilingual";
import type { CareTeamMember, CareTeamRole } from "~/types/care-team";
import { Phone, Mail, Star } from "lucide-react";

// Tap-to-call directory, grouped by role. Reads the care-team
// registry; no opinions, no fallbacks — if it's empty, we point the
// user at Settings. Hospital / on-call phone from legacy settings is
// intentionally not surfaced here; the emergency card owns those.

const ROLE_ORDER: CareTeamRole[] = [
  "oncologist",
  "surgeon",
  "nurse",
  "gp",
  "allied_health",
  "family",
  "other",
];

const ROLE_LABEL: Record<CareTeamRole, { en: string; zh: string }> = {
  oncologist: { en: "Oncology", zh: "肿瘤科" },
  surgeon: { en: "Surgery", zh: "外科" },
  nurse: { en: "Nursing", zh: "护理" },
  gp: { en: "GP", zh: "全科医师" },
  allied_health: { en: "Allied health", zh: "康复 / 营养" },
  family: { en: "Family", zh: "家人" },
  other: { en: "Other", zh: "其他" },
};

export function CallList() {
  const locale = useLocale();
  const members = useLiveQuery(() => db.care_team.toArray(), []);

  const grouped = useMemo(() => {
    const map = new Map<CareTeamRole, CareTeamMember[]>();
    for (const m of members ?? []) {
      const list = map.get(m.role) ?? [];
      list.push(m);
      map.set(m.role, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (Boolean(a.is_lead) !== Boolean(b.is_lead)) return a.is_lead ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }
    return map;
  }, [members]);

  const L = useBilingual();

  if (members === undefined) return null;

  return (
    <section>
      <h2 className="eyebrow mb-2">{L("Call the team", "联系团队")}</h2>
      {members.length === 0 ? (
        <div className="rounded-[var(--r-md)] border border-dashed border-ink-200 bg-paper-2 p-4 text-[12.5px] text-ink-500">
          {L(
            "No one listed yet. Add the oncologist, on-call nurse, and family chaperones in Settings.",
            "还没有成员。请先在设置中添加肿瘤科医师、值班护士与家人。",
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {ROLE_ORDER.map((role) => {
            const list = grouped.get(role) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={role} className="space-y-1.5">
                <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
                  {ROLE_LABEL[role][locale]}
                </div>
                <ul className="divide-y divide-ink-100 overflow-hidden rounded-[var(--r-md)] border border-ink-100 bg-paper-2">
                  {list.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13.5px] font-medium text-ink-900">
                            {m.name}
                          </span>
                          {m.is_lead && (
                            <Star
                              className="h-3 w-3 fill-[var(--tide-2)] text-[var(--tide-2)]"
                              aria-label={L("Lead", "主要")}
                            />
                          )}
                        </div>
                        {(m.specialty || m.organisation) && (
                          <div className="text-[11.5px] text-ink-500">
                            {[m.specialty, m.organisation]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {m.phone && (
                          <a
                            href={`tel:${m.phone}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--tide-soft)] text-[var(--tide-2)] hover:brightness-95"
                            aria-label={L("Call", "拨打")}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {m.email && (
                          <a
                            href={`mailto:${m.email}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-ink-700 hover:bg-ink-200"
                            aria-label={L("Email", "邮件")}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
