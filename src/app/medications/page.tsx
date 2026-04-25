"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { DRUG_REGISTRY } from "~/config/drug-registry";
import { ChevronRight } from "lucide-react";
import type { MedicationCategory, DrugInfo } from "~/types/medication";

const CATEGORY_LABELS: Record<MedicationCategory, { en: string; zh: string }> = {
  chemo: { en: "Chemotherapy", zh: "化疗" },
  targeted: { en: "Targeted / Investigational", zh: "靶向 / 试验性" },
  immunotherapy: { en: "Immunotherapy", zh: "免疫治疗" },
  antiemetic: { en: "Antiemetics", zh: "止吐药" },
  steroid: { en: "Corticosteroids", zh: "皮质类固醇" },
  pert: { en: "PERT (Enzyme Replacement)", zh: "PERT（酶替代）" },
  neuropathy: { en: "Neuropathy Support", zh: "神经病变支持" },
  anticoagulant: { en: "Anticoagulation", zh: "抗凝" },
  gcsf: { en: "G-CSF (Growth Factors)", zh: "G-CSF（生长因子）" },
  analgesic: { en: "Pain Management", zh: "疼痛管理" },
  sleep: { en: "Sleep & Rest", zh: "睡眠与休息" },
  mental: { en: "Mental Health", zh: "心理健康" },
  gi: { en: "GI Support", zh: "胃肠支持" },
  appetite: { en: "Appetite & Nutrition", zh: "食欲与营养" },
  supplement: { en: "Supplements", zh: "补充剂" },
  behavioural: { en: "Behavioural Interventions", zh: "行为干预" },
  other: { en: "Other", zh: "其他" },
};

const CATEGORY_ORDER: MedicationCategory[] = [
  "chemo",
  "targeted",
  "antiemetic",
  "steroid",
  "pert",
  "neuropathy",
  "anticoagulant",
  "gcsf",
  "analgesic",
  "sleep",
  "mental",
  "gi",
  "appetite",
  "supplement",
  "behavioural",
  "other",
];

export default function MedicationsPage() {
  const locale = useLocale();

  const grouped = useMemo(() => {
    const groups: Record<MedicationCategory, DrugInfo[]> = {
      chemo: [],
      targeted: [],
      immunotherapy: [],
      antiemetic: [],
      steroid: [],
      pert: [],
      neuropathy: [],
      anticoagulant: [],
      gcsf: [],
      analgesic: [],
      sleep: [],
      mental: [],
      gi: [],
      appetite: [],
      supplement: [],
      behavioural: [],
      other: [],
    };
    for (const drug of DRUG_REGISTRY) {
      groups[drug.category].push(drug);
    }
    return groups;
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 md:p-8">
      <PageHeader
        title="Medications & Interventions"
        subtitle={
          locale === "zh"
            ? "所有当前和潜在的药物及行为干预。轻点任何一个以查看详情、副作用、监测及相互作用。"
            : "All current and potential medications and behavioural interventions. Tap any to view details, side effects, monitoring, and interactions."
        }
      />

      <div className="space-y-6">
        {CATEGORY_ORDER.map((cat) => {
          const drugs = grouped[cat];
          if (drugs.length === 0) return null;

          const label = CATEGORY_LABELS[cat];
          const catLabel = locale === "zh" ? label.zh : label.en;

          return (
            <div key={cat}>
              <h2 className="eyebrow mb-3">{catLabel}</h2>
              <div className="space-y-2">
                {drugs.map((drug) => (
                  <Link key={drug.id} href={`/medications/${drug.id}`}>
                    <Card className="transition-colors hover:bg-ink-100/40">
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex-1">
                          <div className="font-medium text-ink-900">
                            {locale === "zh"
                              ? drug.name.zh
                              : drug.name.en}
                          </div>
                          {drug.aliases.length > 0 && (
                            <div className="mt-1 text-xs text-ink-400">
                              {drug.aliases.join(", ")}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-ink-300" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
